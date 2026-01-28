module.exports = function (nodecg) {
	const fs = require('fs');
	const path = require('path');
	const express = require('express');
	const app = express();

	const { execFile } = require('child_process');
	const ffprobePath = require('ffprobe-static').path;

	const replayBufferPath = nodecg.Replicant('replayBufferPath');
	const replayPrefix = nodecg.Replicant('replayPrefix');
	const folderContents = nodecg.Replicant('folderContents');
	const totalHighlightDuration = nodecg.Replicant('totalHighlightDuration', {
		defaultValue: 0
	});

	const maxReplayCount = nodecg.Replicant('maxReplayCount', {
		defaultValue: 5
	});

	let updateInterval;
	let pauseDurationCalc = false;

	// Video folder content update logic
	function updateFolderContents(folderPath) {
		if (!folderPath) return;

		fs.readdir(folderPath, (err, files) => {
			if (err) {
				nodecg.log.error('Error in reading the folder: ', err);
				folderContents.value = [];
				clearInterval(updateInterval);
				nodecg.sendMessage('folderError', err);
				return;
			}

			// Grab the .mp4 and .mkv files with the user defined prefix
			let videoFiles = files.filter(file =>
				(file.endsWith('.mp4') || file.endsWith('.mkv')) && file.startsWith(replayPrefix.value)
			);

			// Sort by file creation time
			videoFiles = videoFiles
				.map(file => ({
					file,
					time: fs.statSync(path.join(folderPath, file)).ctimeMs
				}))
				.sort((a, b) => a.time - b.time) // oldest first
				.map(f => f.file);

			// Enforce max replay count
			if (videoFiles.length > maxReplayCount.value) {
				const excess = videoFiles.length - maxReplayCount.value;
				videoFiles = videoFiles.slice(excess); // keep the newest videos only
			}

			folderContents.value = videoFiles;
			recalcTotalDuration(folderPath, videoFiles);
		});
	}


	let currentFolderPath = '';

	replayBufferPath.on('change', (newPath) => {
		if (newPath) {
			updateFolderContents(newPath);
		}

		if (newPath && newPath !== currentFolderPath) {
			currentFolderPath = newPath;

			// Clear any existing interval
			if (updateInterval) {
				clearInterval(updateInterval);
			}

			// Set a new interval to update folder contents every 2 seconds
			nodecg.log.info('Folder update loop started.');
			updateInterval = setInterval(() => {
				updateFolderContents(newPath);
			}, 2000);

			// Check if the router stack exists and filter only if it does
			if (app._router && app._router.stack) {
				app._router.stack = app._router.stack.filter((layer) => {
					return !(layer.name === 'serveStatic' && layer.handle.name === 'staticMiddleware');
				});
			}

			// Add the new static route
			app.use('/media', express.static(path.resolve(newPath)));

			nodecg.log.info(`Serving files from: ${newPath} at /media`);
		}
	});


	nodecg.listenFor('moveVideos', async function () {
		const newFolderPath = path.join(replayBufferPath.value, 'saved_replays');

		if (!fs.existsSync(newFolderPath)) {
			fs.mkdirSync(newFolderPath, { recursive: true });
			nodecg.log.info(`Created new folder: ${newFolderPath}`);
		}

		const filesToMove = folderContents.value;

		if (!Array.isArray(filesToMove) || filesToMove.length === 0) return;

		// Pause folder update loop while moving
		if (updateInterval) {
			clearInterval(updateInterval);
			updateInterval = null;
		}
		pauseDurationCalc = true;

		// Sequential move
		for (const video of filesToMove) {
			const oldVideoPath = path.join(currentFolderPath, video);
			const newVideoPath = path.join(newFolderPath, video);

			try {
				await new Promise((resolve, reject) => {
					fs.rename(oldVideoPath, newVideoPath, (err) => {
						if (err) return reject(err);
						resolve();
					});
				});
			} catch (err) {
				nodecg.log.error(`Error moving file ${video}: ${err.message}`);
			}
		}

		// Resume duration calculation and refresh folder contents
		pauseDurationCalc = false;
		updateFolderContents(currentFolderPath);
		updateInterval = setInterval(() => updateFolderContents(currentFolderPath), 2000);

		// Single summary log
		nodecg.log.info(`${filesToMove.length} videos moved to the saved_replays folder`);
	});


	app.use('/graphics-media', express.static(path.resolve(__dirname, '../graphics')));

	// Functions to calculate the total duration of the video files in the array
	function getVideoDuration(filePath) {
		return new Promise((resolve, reject) => {
			execFile(ffprobePath, [
				'-v', 'error',
				'-show_entries', 'format=duration',
				'-of', 'default=noprint_wrappers=1:nokey=1',
				filePath
			], (err, stdout) => {
				if (err) return reject(err);
				const duration = parseFloat(stdout);
				resolve(isNaN(duration) ? 0 : duration);
			});
		});
	}

	async function recalcTotalDuration(folderPath, videoFiles) {
		if (!folderPath || !Array.isArray(videoFiles)) return;

		let total = 0;

		for (const video of videoFiles) {
			const videoPath = path.join(folderPath, video);
			try {
				const dur = await getVideoDuration(videoPath);
				total += dur;
			} catch (err) {
				nodecg.log.warn(`Failed to read duration of ${video}:`, err.message);
			}
		}

		totalHighlightDuration.value = total; // in seconds
	}

	// Mount the app to NodeCG
	nodecg.mount(app);

};

