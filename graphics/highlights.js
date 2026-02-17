const folderContents = nodecg.Replicant('folderContents');

const playerContainer = document.getElementById('playerContainer');
const videoPlayerTop = document.getElementById('videoPlayerTop');
const videoPlayerBottom = document.getElementById('videoPlayerBottom');
const videoPlayerStinger = document.getElementById('videoPlayerStinger');

const stingerSrc = 'http://localhost:9090/graphics-media/output.webm';

let videoIndex = 0;
let videoList = [];
let playbackStarted = false;

folderContents.on('change', (newFolderContents = []) => {
    if (
        newFolderContents.length !== videoList.length ||
        !newFolderContents.every((v, i) => v === videoList[i])
    ) {
        videoList = newFolderContents;
        console.log(`List updated, now contains ${videoList.length} videos.`);

        if (!playbackStarted && videoList.length > 0) {
            playbackStarted = true;
            videoIndex = 0;
        }
    }
});

const transitionTime = 1;

// Audio fade logic

const interval = 50;
const step = interval / 700;

const fadeState = new WeakMap();

function clearFade(video) {
    const id = fadeState.get(video);
    if (id) {
        clearInterval(id);
        fadeState.delete(video);
    }
}

function audioFadeIn(video) {
    clearFade(video);
    video.volume = 0;

    const id = setInterval(() => {
        if (video.volume < 1) {
            video.volume = Math.min(video.volume + step, 1);
        } else {
            clearFade(video);
        }
    }, interval);

    fadeState.set(video, id);
}

function audioFadeOut(video) {
    clearFade(video);
    video.volume = 1;

    const id = setInterval(() => {
        if (video.volume > 0) {
            video.volume = Math.max(video.volume - step, 0);
        } else {
            clearFade(video);
        }
    }, interval);

    fadeState.set(video, id);
}

// Utility

function resetVideo(video) {
    video.pause();
    video.oncanplaythrough = null;
    video.ontimeupdate = null;
    clearFade(video);
    video.removeAttribute('src');
    video.load();
}

// Core playback logic

function playVideo() {
    nodecg.sendMessage('disableButton');
    console.log(`Index / Videos: ${videoIndex}/${videoList.length}`);

    if (videoList.length === 0) {
        nodecg.sendMessage('enableButton');
        return;
    }

    if (videoIndex >= videoList.length) {
        playerContainer.classList.remove('active');
        nodecg.sendMessage('enableButton');
        return;
    }

    const currentVideo = videoList[videoIndex];
    const isTop = videoIndex % 2 === 0;

    const active = isTop ? videoPlayerTop : videoPlayerBottom;
    const inactive = isTop ? videoPlayerBottom : videoPlayerTop;

    resetVideo(active);

    active.src = `http://localhost:9090/media/${encodeURIComponent(currentVideo)}`;
    active.load();

    active.oncanplaythrough = () => {
        audioFadeIn(active);
        active.play();

        playerContainer.classList.add('active');

        if (active === videoPlayerTop) {
            videoPlayerTop.classList.remove('hidden');
        } else {
            videoPlayerTop.classList.add('hidden');
        }

        // Schedule transition precisely
        const transitionDelay = (active.duration - transitionTime) * 1000;

        setTimeout(() => {
            audioFadeOut(active);
            videoIndex++;
            playVideo();
        }, transitionDelay);
    };

}


// Trigger
nodecg.listenFor('playVideos', () => {
    console.log('Message received: start videos.');
    videoIndex = 0;
    playbackStarted = true;
    playVideo();
});