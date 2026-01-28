const replayBufferPath = nodecg.Replicant('replayBufferPath');
const replayPrefix = nodecg.Replicant('replayPrefix');
const folderContents = nodecg.Replicant('folderContents');
const folderInput = document.getElementById('replayBufferPath');
const prefixInput = document.getElementById('replayPrefix');

const totalDurationRep = nodecg.Replicant('totalHighlightDuration');

const timeTotalEl = document.getElementById('timeTotal');

totalDurationRep.on('change', seconds => {
    if (!timeTotalEl) return;

    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    const formatted = `${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;

    // Update the DOM
    timeTotalEl.textContent = formatted;
    console.log('Total Duration ' + formatted)
})

document.getElementById('setFolder').addEventListener('click', function () {
    replayBufferPath.value = folderInput.value.trim();
});

replayBufferPath.on('change', (newValue) => {
    folderInput.value = replayBufferPath.value;
    console.log('Replay buffer folder updated to: ', newValue);
});

document.getElementById('setPrefix').addEventListener('click', function () {
    replayPrefix.value = prefixInput.value;
});

replayPrefix.on('change', (newValue) => {
    prefixInput.value = replayPrefix.value;
    console.log('Replay prefix has been set to: ', replayPrefix.value);
})

folderContents.on('change', (newContents) => {
    const folderList = document.getElementById("videoFiles");
    folderList.innerHTML = '';

    newContents.forEach(file => {
        const listItem = document.createElement('li');
        listItem.textContent = file;
        folderList.appendChild(listItem);
    });
});

const settingsButton = document.getElementById('toggleSettings');

settingsButton.addEventListener('click', function () {
    const settings = document.getElementById('settings');
    if (settings.classList.contains('hidden')) {
        settings.classList.remove('hidden');
        settingsButton.classList.add('buttonActive');
    } else {
        settings.classList.add('hidden');
        settingsButton.classList.remove('buttonActive');
    }
});

// Replay count logic
window.addEventListener('DOMContentLoaded', () => {
    const maxReplayCount = nodecg.Replicant('maxReplayCount');
    const maxReplayCountEl = document.getElementById('maxReplayCountEl');
    const setReplayCountBtn = document.getElementById('setReplayCountBtn');


    // Initialize input with current replicant value
    maxReplayCount.on('change', (newVal) => {
        maxReplayCountEl.value = newVal;
    });

    // Update replicant when button is clicked
    setReplayCountBtn.addEventListener('click', function () {
        const val = parseInt(maxReplayCountEl.value, 10);

        if (!isNaN(val) && val > 0) {
            maxReplayCount.value = val;
            nodecg.log.info(`Max replay count set to ${val}`);
        } else {
            alert('Please enter a valid number greater than 0.');
            maxReplayCountEl.value = maxReplayCount.value;
        }
    });
});


const playButton = document.getElementById('startButton');
playButton.addEventListener('click', function () {
    nodecg.sendMessage('playVideos');
})

const moveButton = document.getElementById('moveButton');
moveButton.addEventListener('click', function () {
    nodecg.sendMessage('moveVideos');
})

nodecg.listenFor('disableButton', function () {
    playButton.disabled = true;
    playButton.classList.add('buttonDisabled');
    moveButton.disabled = true;
    moveButton.classList.add('buttonDisabled');
})

nodecg.listenFor('enableButton', function () {
    playButton.disabled = false;
    playButton.classList.remove('buttonDisabled');
    moveButton.disabled = false;
    moveButton.classList.remove('buttonDisabled');
})

nodecg.listenFor('folderError', function () {
    alert('Not a viable file path. Please try again.');
})
