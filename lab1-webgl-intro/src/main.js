const urlParams = new URLSearchParams(window.location.search);
const currentTask = urlParams.get('task') ?? '1';

const select = document.getElementById('taskSelect');
if (select) {
    select.value = currentTask;
    select.addEventListener('change', (e) => {
        window.location.href = `?task=${e.target.value}`;
    });
}

import(`./tasks/task${currentTask}.js`)
    .catch(err => console.error(`Failed to load task ${currentTask}:`, err));
