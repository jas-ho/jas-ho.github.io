let tasks = [];
let focusedUUID = null;

function saveTasksToLocalStorage(tasks) {
  try {
    const serializedTasks = JSON.stringify(tasks);
    localStorage.setItem('tasks', serializedTasks);
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      alert('Storage limit exceeded. Please delete some tasks.');
    } else {
      console.error('Failed to save tasks:', e);
    }
  }
}

function loadTasksFromLocalStorage() {
  try {
    const serializedTasks = localStorage.getItem('tasks');
    if (serializedTasks) {
      const tasks = JSON.parse(serializedTasks);
      if (Array.isArray(tasks)) {
        tasks.forEach(task => {
          if (!task.uuid) {
            task.uuid = generateUUID();
          }
          if (task.startTime === undefined) task.startTime = null;
          if (task.endTime === undefined) task.endTime = null;
        });
        return tasks;
      }
    }
  } catch (e) {
    console.error('Failed to load tasks:', e);
  }
  return [];
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0; // Generate a random number between 0 and 15
      const v = c === 'x' ? r : (r & 0x3 | 0x8); // Set the version to 4
      return v.toString(16); // Convert to hexadecimal
  });
}

let showCompletedTasks = true;

function toggleCompletedTasks() {
  showCompletedTasks = !showCompletedTasks;
  updateToggleCompletedButton();
  renderTasks();
}

function updateToggleCompletedButton() {
  console.log('Updating toggle completed button');
  console.log('Show completed tasks:', showCompletedTasks);
  const toggleCompletedBtn = document.querySelector('[data-toggle-completed]');
  if (!toggleCompletedBtn) {
    console.error('Toggle completed button not found');
    return;
  }

  let icon = document.querySelector('[data-toggle-completed-icon]');

  if (!icon) {
    console.error('Icon not found in toggle completed button');
    return;
  }

  if (showCompletedTasks) {
    icon.setAttribute('data-feather', 'eye-off');
    toggleCompletedBtn.title = 'Hide Completed Tasks';
  } else {
    icon.setAttribute('data-feather', 'eye');
    toggleCompletedBtn.title = 'Show Completed Tasks';
  }

  console.log('Updated icon:', icon);
  console.log('Updated button title:', toggleCompletedBtn.title);

  feather.replace();
}

function clearCompletedTasks() {
  if (confirm('Are you sure you want to delete all completed tasks?')) {
    tasks = tasks.filter(task => !task.completed);
    saveTasksToLocalStorage(tasks);
    renderTasks();
  }
}

// Update renderTasks to respect the visibility of completed tasks
function renderTasks() {
  const taskList = document.getElementById('taskList');
  taskList.innerHTML = '';
  let lastMarkedTask = getCurrentBenchmarkTask(); // Use the new function

  tasks.forEach((task) => {
    if (task.completed && !showCompletedTasks) return; // Skip completed tasks if hidden

    const index = tasks.indexOf(task);
    const li = document.createElement('li');
    li.setAttribute('data-task-uuid', task.uuid); // Use UUID

    li.innerHTML = `
    <span class="task-text" ondblclick="editTaskTitle('${task.uuid}')">${task.text}</span>
    <span class="stopwatch" ondblclick="editTaskTime('${task.uuid}')">${formatTime(getDisplayedTime(task))}</span>
    <div class="controls">
      <button class="start-btn" onclick="handleStartButtonClick(event, '${task.uuid}')" title="${task.lastStartedTime !== null ? 'Pause' : 'Start'}">
        <i data-feather="${task.lastStartedTime !== null ? 'pause' : 'play'}"></i>
      </button>
      <button class="mark-btn" onclick="toggleMark('${task.uuid}')" title="${task.marked ? 'Unmark' : 'Mark'}">
        <i data-feather="star"></i>
      </button>
      <button class="complete-btn" onclick="toggleComplete('${task.uuid}')" title="${task.completed ? 'Reopen' : 'Complete'}">
        <i data-feather="check"></i>
      </button>
      <button class="delete-btn" onclick="deleteTask('${task.uuid}')" title="Delete">
        <i data-feather="x"></i>
      </button>
      <button class="defer-btn" onclick="toggleDeferred('${task.uuid}')" title="${task.deferred ? 'Undefer' : 'Defer'}">
      <i data-feather="${task.deferred ? 'chevron-left' : 'chevron-right'}"></i>
      </button>
    </div>
  `;
    li.setAttribute('tabindex', '0');
    li.onclick = () => setFocus(task.uuid);
    if (task.marked) li.classList.add('marked');
    if (task.completed) li.classList.add('completed');
    if (task.lastStartedTime !== null) li.classList.add('running');
    if (task === lastMarkedTask) li.classList.add('last-marked'); // Highlight the last marked task
    if (task.uuid === focusedUUID) {
      li.classList.add('focused');
      setTimeout(() => li.focus(), 0); // Ensure focus is set after rendering
    }
    if (task.deferred) {
      li.style.opacity = '0.5'; // Directly set opacity
    }
    taskList.appendChild(li);
    feather.replace();
  });

  if (tasks.length === 0) {
    focusInputBox();
  }
  updateProgressBar();
  updateToggleCompletedButton();
}

function addTask(event) {
  event.preventDefault();
  const input = document.getElementById('taskInput');
  if (input.value) {
    const newTask = {
      uuid: generateUUID(),
      text: input.value,
      marked: false,
      completed: false,
      cumulativeTimeInSeconds: 0,
      lastStartedTime: null,
      startTime: null,
      endTime: null,
      parentUUID: null,
      deferred: false // Add deferred property
    };
    tasks.push(newTask);
    input.value = '';
    saveTasksToLocalStorage(tasks);
    renderTasks();
    input.focus();
    logInteraction('addTask', newTask.uuid);
  }
}

function toggleMark(uuid) {
  const task = findTaskByUUID(uuid);
  if (task) {
    task.marked = !task.marked;
    saveTasksToLocalStorage(tasks);
    renderTasks();
    setFocus(uuid);
    logInteraction('toggleMark', uuid);
  }
}
function toggleComplete(uuid) {
  const task = findTaskByUUID(uuid);
  if (!task) return;
  setFocus(uuid);

  if (task.completed) {
    reopenTask(uuid);
  } else {
    completeTask(uuid);
  }
}

function completeTask(uuid) {
  logInteraction('completeTask', uuid);
  // Use setTimeout to delay the prompt
  setTimeout(() => {
    promptForReflection(uuid, () => {
      const task = findTaskByUUID(uuid);
      if (task) {
        stopTask(task);
        task.completed = true;
        saveTasksToLocalStorage(tasks);
        renderTasks();
      }
    });
  }, 0);
}

function reopenTask(uuid) {
  logInteraction('reopenTask', uuid);
  const task = findTaskByUUID(uuid);
  if (task) {
    task.endTime = null;
    task.completed = false;
    saveTasksToLocalStorage(tasks);
    renderTasks();
  }
}

function promptForReflection(uuid, onComplete) {
  const task = findTaskByUUID(uuid);
  if (task) {
    const elapsedTime = Math.ceil(task.cumulativeTimeInSeconds / 60);

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifierKey = isMac ? '⌘' : 'Ctrl';

    const dialog = document.createElement('div');
    dialog.classList.add('reflection-dialog');
    dialog.innerHTML = `
      <p>You worked on "${task.text}" for ${elapsedTime} minutes. How did it go?</p>
      <input type="text" id="reflection-input" placeholder="Enter your reflection here...">
      <div class="dialog-actions">
        <button id="complete-task-btn">Complete task now (Enter)</button>
        <button id="shelve-task-btn">Shelve task for later (${modifierKey}+Enter)</button>
        <button id="cancel-btn">Cancel (Esc)</button>
      </div>
    `;
    document.body.appendChild(dialog);

    // Add inline styles for the dialog and input
    dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 1000;
      width: 90%;
      max-width: 800px;
    `;

    const input = document.getElementById('reflection-input');
    input.style.cssText = `
      width: 100%;
      padding: 8px;
      margin: 10px 0;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 16px;
    `;

    function handleComplete() {
      saveReflection(uuid, input.value);
      closeDialog(dialog);
      onComplete();
      initiatePreselection();
    }

    function handleShelve() {
      saveReflection(uuid, input.value);
      shelveTask(uuid);
      closeDialog(dialog);
      onComplete();
      initiatePreselection();
    }

    function handleCancel() {
      task.completed = false;
      saveTasksToLocalStorage(tasks);
      renderTasks();
      closeDialog(dialog);
    }

    document.getElementById('complete-task-btn').addEventListener('click', handleComplete);
    document.getElementById('shelve-task-btn').addEventListener('click', handleShelve);
    document.getElementById('cancel-btn').addEventListener('click', handleCancel);

    function handleKeydown(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
          handleShelve();
        } else {
          handleComplete();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    }

    dialog.addEventListener('keydown', handleKeydown);

    dialog.addEventListener('DOMNodeRemoved', () => {
      dialog.removeEventListener('keydown', handleKeydown);
    });

    // Clear the input and focus it
    input.value = '';
    input.focus();
  }
}

function saveReflection(uuid, reflection) {
  const task = findTaskByUUID(uuid);
  if (task) {
    const timestamp = formatDateTime(Date.now());
    task.comments = (task.comments || '') + (task.comments ? `\n` : '') + `[${timestamp}] Reflection: ${reflection}`;
    saveTasksToLocalStorage(tasks);
    renderTasks();
  }
}

function shelveTask(uuid) {
  const task = findTaskByUUID(uuid);
  if (task) {
    const timestamp = formatDateTime(Date.now());

    const newTask = {
      uuid: generateUUID(), // Generate a new UUID for the shelved task
      text: task.text, // Keep the same text as the original task
      completed: false,
      marked: false,
      cumulativeTimeInSeconds: 0,
      lastStartedTime: null,
      startTime: null,
      endTime: null,
      comments: `[${timestamp}] Shelved`, // Clear previous comments and add shelved note
      parentUUID: uuid // Reference to the original task's UUID
    };
    tasks.push(newTask);

    saveTasksToLocalStorage(tasks);
    renderTasks();
  }
}

function toggleDeferred(uuid) {
  const task = findTaskByUUID(uuid);
  if (!task) return;
  setFocus(uuid);
  task.deferred = !task.deferred;
  saveTasksToLocalStorage(tasks);
  renderTasks();
  logInteraction('toggleDeferred', uuid);
  console.log('deferral status:', task.deferred);
}

function closeDialog(dialog) {
  if (document.body.contains(dialog)) {
    document.body.removeChild(dialog);
  }
}

function deleteTask(uuid) {
  const index = tasks.findIndex(task => task.uuid === uuid);
  if (index !== -1) {
    tasks.splice(index, 1);
    saveTasksToLocalStorage(tasks);
    renderTasks();
    if (tasks.length > 0) {
      setFocus(tasks[Math.min(index, tasks.length - 1)].uuid);
    } else {
      focusedUUID = null;
    }
    logInteraction('deleteTask', uuid);
  }
}

let isToggling = false;

function startTask(task) {
  task.lastStartedTime = Date.now();
  if (task.startTime === null) {
    task.startTime = task.lastStartedTime;
  }
}

function stopTask(task) {
  if (task.lastStartedTime !== null) {
    task.cumulativeTimeInSeconds += (Date.now() - task.lastStartedTime) / 1000;
    task.lastStartedTime = null;
    task.endTime = Date.now();
  }
}

function toggleStart(uuid) {
  const task = findTaskByUUID(uuid);
  if (task) {
    if (isToggling) return; // Prevent multiple triggers
    isToggling = true;

    // Stop all other running tasks
    tasks.forEach(t => {
      if (t.lastStartedTime !== null && t.uuid !== uuid) {
        stopTask(t);
      }
    });

    if (task.lastStartedTime === null) {
      startTask(task);
    } else {
      stopTask(task);
    }

    saveTasksToLocalStorage(tasks);
    renderTasks();
    setFocus(uuid);
    logInteraction('toggleStart', uuid);

    setTimeout(() => {
      isToggling = false;
    }, 100);
  }
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours > 0 ? hours + ':' : ''}${hours > 0 && mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function getDisplayedTime(task) {
  if (task.lastStartedTime !== null) {
    const elapsedTime = (Date.now() - task.lastStartedTime) / 1000;
    return task.cumulativeTimeInSeconds + elapsedTime;
  }
  return task.cumulativeTimeInSeconds;
}

function setFocus(uuid) {
  focusedUUID = uuid;
  updateFocus();
}

function updateFocus() {
  const taskItems = document.querySelectorAll('#taskList li');
  const taskInput = document.getElementById('taskInput');
  taskItems.forEach(item => item.classList.remove('focused'));
  if (focusedUUID) {
    const focusedItem = document.querySelector(`li[data-task-uuid="${focusedUUID}"]`);
    if (focusedItem) {
      focusedItem.classList.add('focused');
      focusedItem.focus();
    } else {
      // If the focused item is not found, focus the input box
      focusedUUID = null;
      taskInput.focus();
    }
  } else {
    // No task is focused, focus the input box
    taskInput.focus();
  }
}

// Ensure the taskList can receive focus
document.getElementById('taskList').setAttribute('tabindex', '0');

function toggleFullscreen() {
  const container = document.getElementById('fvp-container');
  const fullscreenToggle = document.getElementById('fullscreen-toggle');
  container.classList.toggle('fullscreen');
  fullscreenToggle.textContent = container.classList.contains('fullscreen') ? '⮌' : '⛶';
  fullscreenToggle.title = container.classList.contains('fullscreen') ? 'Exit Fullscreen' : 'Enter Fullscreen';

  // Hide/show the sidebar and other page elements
  const sidebar = document.querySelector('.sidebar');
  const content = document.querySelector('.content');
  if (sidebar) sidebar.style.display = container.classList.contains('fullscreen') ? 'none' : '';
  if (content) content.style.width = container.classList.contains('fullscreen') ? '100%' : '';

  // Show/hide the inner title
  const innerTitle = container.querySelector('h1');
  if (innerTitle) innerTitle.style.display = container.classList.contains('fullscreen') ? 'block' : 'none';
}

document.getElementById('fullscreen-toggle').addEventListener('click', toggleFullscreen);

function focusFirstTask() {
  if (tasks.length > 0) {
    focusedUUID = tasks[0].uuid;
    updateFocus();
  }
}

function focusInputBox() {
  focusedUUID = null;
  updateFocus();
}

function logInteraction(action, uuid) {
  const task = findTaskByUUID(uuid) || null;
  console.log(`Action: ${action}`, { uuid, task });
}

document.addEventListener('keydown', function(e) {
  const taskList = document.getElementById('taskList');
  const taskInput = document.getElementById('taskInput');

  // Check if the active element is any input field
  if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
    // Allow normal typing in input fields
    if (e.key === 'Escape') {
      focusFirstTask();
      e.preventDefault();
    } else if (e.key === 'ArrowUp' && tasks.length > 0) {
      focusedUUID = tasks[tasks.length - 1].uuid;
      updateFocus();
      logInteraction('navigate', focusedUUID); // Log the action
      e.preventDefault();
    }
    return;
  }

  if (e.key === 'f') { // Toggle Fullscreen
    toggleFullscreen();
    e.preventDefault();
  } else if (e.key === 'h') { // Hide / Show Completed
    toggleCompletedTasks();
    console.log('toggleCompletedTasks');
    e.preventDefault();
  } else if (e.key === 'p') { // Initiate Preselection
    initiatePreselection();
    console.log('initiatePreselection');
    e.preventDefault();
  } else if (e.key === 'n') { // Focus Input Box to add new task
    focusInputBox();
    console.log('focusInput');
    e.preventDefault();
  } else if (e.key === 'Escape') { // Move Focus to First Task
    focusFirstTask();
    e.preventDefault();
  } else if (document.activeElement === taskList || document.activeElement.closest('#taskList')) {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const visibleTasks = tasks.filter(task => !(task.completed && !showCompletedTasks));
      const currentIndex = visibleTasks.findIndex(task => task.uuid === focusedUUID);

      if (e.key === 'ArrowUp') {
        if (currentIndex > 0) {
          setFocus(visibleTasks[currentIndex - 1].uuid);
        } else {
          // If at the first item, wrap to the input box
          focusInputBox();
        }
      } else if (e.key === 'ArrowDown') {
        if (currentIndex < visibleTasks.length - 1) {
          setFocus(visibleTasks[currentIndex + 1].uuid);
        } else {
          // If at the last item, wrap to the input box
          focusInputBox();
        }
      }
      e.preventDefault();
    } else {
      switch (e.key) {
        case 'm': // Mark
          if (focusedUUID) {
            toggleMark(focusedUUID);
            logInteraction('mark', focusedUUID);
          }
          break;
        case 'c': // Complete
          if (focusedUUID) {
            toggleComplete(focusedUUID);
            logInteraction('complete', focusedUUID);
          }
          break;
        case 'd': // Delete
          if (focusedUUID) {
            deleteTask(focusedUUID);
            logInteraction('delete', focusedUUID);
            e.stopPropagation();
            e.preventDefault();
          }
          break;
        case 's': // Start / Stop
          if (focusedUUID) {
            toggleStart(focusedUUID);
            logInteraction('start', focusedUUID);
          }
          break;
        case '0': // Defer / Undefer
          if (focusedUUID) {
            toggleDeferred(focusedUUID);
            logInteraction('defer', focusedUUID);
            e.preventDefault();
          }
          break;
      }
    }
  }
});

document.getElementById('delete-all').addEventListener('click', function() {
  if (confirm('Are you sure you want to delete all tasks?')) {
    tasks = [];
    saveTasksToLocalStorage(tasks);
    renderTasks();
    focusInputBox();
  }
});

document.getElementById('export-btn').addEventListener('click', function() {
  const timestamp = new Date().toISOString().split('T')[0];
  console.log('Timestamp:', timestamp);

  const filename = `${timestamp}_FVP_tasks.json`;
  console.log('Filename:', filename);

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tasks));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", filename);
  console.log('Download attribute:', downloadAnchorNode.download);

  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
});

document.getElementById('import-btn').addEventListener('click', function() {
  document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', function(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const importedTasks = JSON.parse(e.target.result);
        if (Array.isArray(importedTasks)) {
          // Ensure each imported task has startTime and endTime properties
          importedTasks.forEach(task => {
            if (task.startTime === undefined) task.startTime = null;
            if (task.endTime === undefined) task.endTime = null;
          });
          tasks = importedTasks;
          saveTasksToLocalStorage(tasks);
          renderTasks();
        } else {
          alert('Invalid file format.');
        }
      } catch (error) {
        alert('Error reading file.');
      }
    };
    reader.readAsText(file);
  }
});

// Event listeners for the new buttons
document.getElementById('toggle-completed-btn').addEventListener('click', toggleCompletedTasks);
document.getElementById('clear-completed-btn').addEventListener('click', clearCompletedTasks);

// Load tasks when the page loads
document.addEventListener('DOMContentLoaded', () => {
  tasks = loadTasksFromLocalStorage();
  renderTasks();
  startUpdatingTime(); // Start updating the time display
  document.getElementById('taskList').focus();
  feather.replace();
  updateToggleCompletedButton();
});

// Listen for changes to LocalStorage
window.addEventListener('storage', (event) => {
  if (event.key === 'tasks') {
    tasks = loadTasksFromLocalStorage();
    renderTasks();
  }
});

function handleStartButtonClick(event, uuid) {
  event.stopPropagation(); // Prevent event bubbling
  event.preventDefault(); // Prevent default button behavior
  toggleStart(uuid); // Call the toggleStart function
}

function updateDisplayedTimes() {
  const taskItems = document.querySelectorAll('#taskList li');

  taskItems.forEach((item) => {
    const uuid = item.getAttribute('data-task-uuid');
    const task = findTaskByUUID(uuid);
    if (task) {
      const stopwatch = item.querySelector('.stopwatch');
      if (stopwatch) {
        stopwatch.innerHTML = formatTime(getDisplayedTime(task));
      }
    }
  });
}

function formatCumulativeTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}:${minutes < 10 ? '0' : ''}${minutes}`;
}

// New function to update the progress bar and cumulative work time
function updateProgressBar() {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(task => task.completed).length;
  const progressBar = document.getElementById('progress-bar');
  const cumulativeTimeInSeconds = tasks.reduce((total, task) => total + getDisplayedTime(task), 0); // Total time in seconds

  // Update progress bar width
  progressBar.style.width = totalTasks > 0 ? `${(completedTasks / totalTasks) * 100}%` : '0%';

  // Update cumulative work time display in hh:mm format
  document.getElementById('cumulative-time').textContent = `Cumulative Work Time: ${formatCumulativeTime(cumulativeTimeInSeconds)} | Completed: ${completedTasks} | Total: ${totalTasks}`;

  // Set hover text for progress bar
  progressBar.setAttribute('data-hover', `${completedTasks} out of ${totalTasks} tasks completed`);
}

// Call this function to start updating the time every second
function startUpdatingTime() {
  setInterval(() => {
    updateDisplayedTimes();
    updateProgressBar(); // Update progress bar and cumulative work time every second
  }, 1000); // Update every second
}

// Function to format date and time as YYYY-MM-DD HH:mm:ss
function formatDateTime(timestamp) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function editTaskTitle(uuid) {
  const task = findTaskByUUID(uuid);
  if (!task) return;

  const taskItem = document.querySelector(`li[data-task-uuid="${uuid}"]`);
  const taskText = taskItem.querySelector('.task-text');

  // Replace the task text with an input for editing
  const input = document.createElement('input');
  input.type = 'text';
  input.value = task.text;
  input.onblur = function() {
    task.text = input.value;
    saveTasksToLocalStorage(tasks);
    renderTasks();
  };
  input.onkeydown = function(e) {
    if (e.key === 'Enter') {
      task.text = input.value;
      saveTasksToLocalStorage(tasks);
      renderTasks();
    }
  };
  taskText.replaceWith(input);
  input.focus();
}

function editTaskTime(uuid) {
  const task = findTaskByUUID(uuid);
  if (!task) return;

  const taskItem = document.querySelector(`li[data-task-uuid="${uuid}"]`);
  const stopwatch = taskItem.querySelector('.stopwatch');

  // Create an input for editing time
  const input = document.createElement('input');
  input.type = 'text';
  input.value = formatTime(getDisplayedTime(task));

  input.onblur = function() {
    const seconds = parseTime(input.value);
    task.cumulativeTimeInSeconds = seconds;
    saveTasksToLocalStorage(tasks);
    renderTasks();
  };

  input.onkeydown = function(e) {
    if (e.key === 'Enter') {
      const seconds = parseTime(input.value);
      task.cumulativeTimeInSeconds = seconds;
      saveTasksToLocalStorage(tasks);
      renderTasks();
    }
  };

  stopwatch.replaceWith(input);
  input.focus();
}

// Helper function to parse time string to seconds
function parseTime(timeStr) {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) {
    // Format: hh:mm:ss
    const [hours, mins, secs] = parts;
    return hours * 3600 + mins * 60 + secs;
  } else if (parts.length === 2) {
    // Format: mm:ss
    const [mins, secs] = parts;
    return mins * 60 + secs;
  }
  return 0;
}

function findTaskByUUID(uuid) {
  return tasks.find(task => task.uuid === uuid);
}

document.getElementById('toggle-shortcuts').addEventListener('click', function() {
  const shortcutsContent = document.getElementById('shortcuts-content');
  const isVisible = shortcutsContent.style.display === 'block';

  shortcutsContent.style.display = isVisible ? 'none' : 'block';
});

// Function to find the last completed marked task
function getPreviousBenchmarkTask() {
  const previousBenchmarkTask = tasks.slice().reverse().find(task => task.marked && task.completed);
  // console.log('Previous Benchmark Task:', previousBenchmarkTask);
  return previousBenchmarkTask;
}

// Function to find the last uncompleted marked task
function getCurrentBenchmarkTask() {
  const currentBenchmarkTask = tasks.slice().reverse().find(task => task.marked && !task.completed);
  // console.log('Current Benchmark Task:', currentBenchmarkTask);
  return currentBenchmarkTask;
}

// Function to get the next uncompleted task after the given task
function getNextUncompletedTask(task) {
  const startIndex = tasks.indexOf(task) + 1;
  const nextUncompletedTask = tasks.slice(startIndex).find(t => !t.completed && !t.deferred);
  // console.log('Next Uncompleted Task:', nextUncompletedTask);
  return nextUncompletedTask;
}

// Function to initiate the preselection process
function initiatePreselection(lastConsideredTask = null) {
  console.log('Initiating Preselection with lastConsideredTask:', lastConsideredTask);

  const previousBenchmarkTask = getPreviousBenchmarkTask();
  console.log('Previous Benchmark Task:', previousBenchmarkTask);

  let currentBenchmarkTask = getCurrentBenchmarkTask();
  if (!currentBenchmarkTask) {
    console.log('No current benchmark task, starting with the first uncompleted task');
    currentBenchmarkTask = tasks.find(task => !task.completed);
    if (currentBenchmarkTask) {
      toggleMark(currentBenchmarkTask.uuid);
    }
  }
  console.log('Current Benchmark Task:', currentBenchmarkTask);

  let nextConsideredTask;
  if (lastConsideredTask) {
    nextConsideredTask = getNextUncompletedTask(lastConsideredTask);
  } else if (previousBenchmarkTask) {
    const previousIndex = tasks.indexOf(previousBenchmarkTask);
    const currentIndex = tasks.indexOf(currentBenchmarkTask);
    if (previousIndex < currentIndex) {
      console.log('Previous Benchmark Task is before the Current Benchmark Task');
      nextConsideredTask = getNextUncompletedTask(currentBenchmarkTask);
    } else {
      nextConsideredTask = getNextUncompletedTask(previousBenchmarkTask);
      if (nextConsideredTask === undefined) {
        console.log('Next considered task is undefined, getting next uncompleted from current benchmark task');
        nextConsideredTask = getNextUncompletedTask(currentBenchmarkTask);
      }
    }
  } else {
    nextConsideredTask = getNextUncompletedTask(currentBenchmarkTask);
  }
  console.log('Next Considered Task:', nextConsideredTask);

  if (nextConsideredTask && nextConsideredTask !== currentBenchmarkTask) {
    compareTasks(currentBenchmarkTask, nextConsideredTask);
  } else {
    finalizePreselection();
  }
}

// Function to compare two tasks and update marked status if necessary
function compareTasks(benchmarkTask, nextConsideredTask) {
  // Create a dialog for task comparison
  const dialog = document.createElement('div');
  dialog.classList.add('comparison-dialog');
  dialog.innerHTML = `
    <p>Which task do you prefer to do next?</p>
    <div class="task-comparison">
      <button class="task-option" id="choose-benchmark">
        <span>${benchmarkTask ? benchmarkTask.text : 'No benchmark task'}</span>
        <span class="key">1</span> <!-- Visual indication for keyboard shortcut -->
      </button>
      <button class="task-option" id="choose-next">
        <span>${nextConsideredTask.text}</span>
        <span class="key">2</span> <!-- Visual indication for keyboard shortcut -->
      </button>
      <button class="task-option" id="defer-next">
        <span>Defer "${nextConsideredTask.text}"</span>
        <span class="key">0</span> <!-- Visual indication for keyboard shortcut -->
      </button>
    </div>
  `;
  document.body.appendChild(dialog);

  // Set the width of the comparison dialog to match the task list
  const taskList = document.getElementById('taskList');
  if (taskList) {
    const taskListWidth = taskList.offsetWidth;
    dialog.style.width = `${taskListWidth}px`;
  }

  function handleChooseBenchmark() {
    closeDialog(dialog);
    initiatePreselection(nextConsideredTask);
    nextConsideredTask = null; // Clear the nextConsideredTask to prevent runaway selection
  }

  function handleChooseNext() {
    if (!nextConsideredTask.marked) {
      toggleMark(nextConsideredTask.uuid);
    }
    closeDialog(dialog);
    initiatePreselection(nextConsideredTask);
    nextConsideredTask = null; // Clear the nextConsideredTask to prevent runaway selection
  }

  function handleDeferNext() {
    toggleDeferred(nextConsideredTask.uuid);
    closeDialog(dialog);
    initiatePreselection(nextConsideredTask);
    nextConsideredTask = null; // Clear the nextConsideredTask to prevent runaway selection
  }

  function handleChooseCancel() {
    closeDialog(dialog);
    finalizePreselection();
  }

  // Add keyboard shortcuts for task selection
  function handleKeydown(e) {
    if (e.key === '1') {
      handleChooseBenchmark();
    } else if (e.key === '2') {
      handleChooseNext();
    } else if (e.key === '0') {
      handleDeferNext();
    } else if (e.key === 'Escape') {
      handleChooseCancel();
    }
  }

  document.addEventListener('keydown', handleKeydown);

  document.getElementById('choose-benchmark').addEventListener('click', handleChooseBenchmark);
  document.getElementById('choose-next').addEventListener('click', handleChooseNext);
  document.getElementById('defer-next').addEventListener('click', handleDeferNext);

  // Remove the event listener when the dialog is closed
  dialog.addEventListener('DOMNodeRemoved', () => {
    document.removeEventListener('keydown', handleKeydown);
  });

  console.log('Comparing Tasks:', { benchmarkTask, nextConsideredTask });
}

// Function to close the comparison dialog
function closeDialog(dialog) {
  if (document.body.contains(dialog)) {
    document.body.removeChild(dialog);
  }
}

// Function to finalize the preselection process; a placeholder for future functionality
function finalizePreselection() {
  console.log('Finalizing Preselection');
  const currentBenchmarkTask = getCurrentBenchmarkTask();
  if (currentBenchmarkTask) {
    console.log('Top Priority Task:', currentBenchmarkTask);
    // Add logic to execute the top priority task or notify the user
  } else {
    console.log('No tasks to execute.');
  }
}

document.getElementById('preselection-btn').addEventListener('click', function() {
  initiatePreselection();
});
