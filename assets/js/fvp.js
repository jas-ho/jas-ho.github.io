let tasks = [];
let focusedIndex = -1;

// Function to save tasks to LocalStorage with error handling
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

// Function to load tasks from LocalStorage with validation
function loadTasksFromLocalStorage() {
  try {
    const serializedTasks = localStorage.getItem('tasks');
    if (serializedTasks) {
      const tasks = JSON.parse(serializedTasks);
      if (Array.isArray(tasks)) {
        // Ensure each task has startTime and endTime properties
        tasks.forEach(task => {
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

// New variable to track visibility of completed tasks
let showCompletedTasks = true;

// Function to toggle visibility of completed tasks
function toggleCompletedTasks() {
  showCompletedTasks = !showCompletedTasks;
  renderTasks();
}

// Function to clear completed tasks
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
  let lastMarkedIndex = tasks.findLastIndex(task => task.marked && !task.completed);
  tasks.forEach((task, index) => {
    if (task.completed && !showCompletedTasks) return; // Skip completed tasks if hidden
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="task-text" ondblclick="editTaskTitle(${index})">${task.text}</span>
      <span class="stopwatch" ondblclick="editTaskTime(${index})">${formatTime(getDisplayedTime(task))}</span>
      <div class="controls">
        <button class="start-btn" onclick="handleStartButtonClick(event, ${index})" title="Start">${task.lastStartedTime !== null ? '⏸' : '▶'}</button>
        <button class="mark-btn" onclick="toggleMark(${index})" title="Mark">★</button>
        <button class="complete-btn" onclick="toggleComplete(${index})" title="${task.completed ? 'Reopen' : 'Complete'}">✓</button>
        <button class="delete-btn" onclick="deleteTask(${index})" title="Delete">×</button>
      </div>
    `;
    li.setAttribute('tabindex', '0');
    li.onclick = () => setFocus(index);
    if (task.marked) li.classList.add('marked');
    if (task.completed) li.classList.add('completed');
    if (task.lastStartedTime !== null) li.classList.add('running');
    if (index === lastMarkedIndex) li.classList.add('last-marked');
    if (index === focusedIndex) li.classList.add('focused');
    taskList.appendChild(li);
  });

  // If the task list is empty, focus on the input box
  if (tasks.length === 0) {
    focusInputBox();
  }

  // Update the progress bar after rendering tasks
  updateProgressBar();
}

function addTask(event) {
  event.preventDefault();
  const input = document.getElementById('taskInput');
  if (input.value) {
    const newTask = {
      text: input.value,
      marked: false,
      completed: false,
      cumulativeTimeInSeconds: 0,
      lastStartedTime: null,
      startTime: null, // Add startTime property
      endTime: null // Add endTime property
    };
    tasks.push(newTask);
    input.value = '';
    saveTasksToLocalStorage(tasks);
    renderTasks();
    input.focus();
    logInteraction('addTask', tasks.length - 1); // Log the action
  }
}

function toggleMark(index) {
  tasks[index].marked = !tasks[index].marked;
  saveTasksToLocalStorage(tasks);
  renderTasks();
  setFocus(index);
  logInteraction('toggleMark', index); // Log the action
}

function toggleComplete(index) {
  tasks[index].completed = !tasks[index].completed;
  if (tasks[index].completed) {
    tasks[index].marked = false;
    if (tasks[index].lastStartedTime !== null) {
      toggleStart(index); // Stop the timer when completing a task
    }
    tasks[index].endTime = Date.now(); // Set endTime when task is completed
    promptForReflection(index); // Prompt for reflection after completing
  } else {
    tasks[index].endTime = null; // Clear endTime if task is reopened
  }
  saveTasksToLocalStorage(tasks);
  renderTasks();
  setFocus(index);
  logInteraction('toggleComplete', index); // Log the action
}

function promptForReflection(index) {
  const task = tasks[index];
  const elapsedTime = Math.ceil(task.cumulativeTimeInSeconds / 60); // Convert to minutes and round up

  // Create a dialog for reflection and action buttons
  const dialog = document.createElement('div');
  dialog.classList.add('reflection-dialog');
  dialog.innerHTML = `
    <p>You worked on "${task.text}" for ${elapsedTime} minutes. How did it go?</p>
    <textarea id="reflection-input" placeholder="Enter your reflection here..."></textarea>
    <div class="dialog-actions">
      <button id="complete-task-btn">Complete task now</button>
      <button id="shelve-task-btn">Shelve task for later</button>
      <button id="cancel-btn">Cancel</button>
    </div>
  `;
  document.body.appendChild(dialog);

  // Add event listeners for the buttons
  document.getElementById('complete-task-btn').addEventListener('click', () => {
    saveReflection(index, document.getElementById('reflection-input').value);
    closeDialog(dialog);
  });

  document.getElementById('shelve-task-btn').addEventListener('click', () => {
    saveReflection(index, document.getElementById('reflection-input').value);
    shelveTask(index);
    closeDialog(dialog);
  });

  document.getElementById('cancel-btn').addEventListener('click', () => {
    tasks[index].completed = false; // Revert task to incomplete status
    saveTasksToLocalStorage(tasks);
    renderTasks();
    closeDialog(dialog);
  });
}

function saveReflection(index, reflection) {
  const task = tasks[index];
  const timestamp = formatDateTime(Date.now()); // Get current timestamp in the new format
  task.comments = (task.comments || '') + (task.comments ? `\n` : '') + `[${timestamp}] Reflection: ${reflection}`;
  saveTasksToLocalStorage(tasks);
  renderTasks();
}

function shelveTask(index) {
  const task = tasks[index];
  const timestamp = formatDateTime(Date.now()); // Get current timestamp in the new format

  const newTask = {
    ...task,
    completed: false,
    marked: false,
    cumulativeTimeInSeconds: 0,
    lastStartedTime: null,
    startTime: null,
    endTime: null,
    comments: `[${timestamp}] Shelved` // Clear previous comments and add shelved note
  };
  tasks.push(newTask);

  saveTasksToLocalStorage(tasks);
  renderTasks();
}

function closeDialog(dialog) {
  document.body.removeChild(dialog);
}

function deleteTask(index) {
  tasks.splice(index, 1);
  saveTasksToLocalStorage(tasks);
  renderTasks();
  if (index > 0) {
    setFocus(index - 1);
  } else if (tasks.length > 0) {
    setFocus(0);
  } else {
    focusedIndex = -1;
  }
  logInteraction('deleteTask', index); // Log the action
}

let isToggling = false;

function toggleStart(index) {
  if (isToggling) return; // Prevent multiple triggers
  isToggling = true;

  const task = tasks[index];
  if (task.lastStartedTime === null) {
    task.lastStartedTime = Date.now();
    if (task.startTime === null) {
      task.startTime = task.lastStartedTime; // Set startTime if not already set
    }
  } else {
    task.cumulativeTimeInSeconds += (Date.now() - task.lastStartedTime) / 1000;
    task.lastStartedTime = null;
  }
  saveTasksToLocalStorage(tasks);
  renderTasks();
  setFocus(index);
  logInteraction('toggleStart', index); // Log the action

  // Reset the flag after a short delay
  setTimeout(() => {
    isToggling = false;
  }, 100); // Adjust the delay as needed
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

function setFocus(index) {
  focusedIndex = index;
  updateFocus();
}

function updateFocus() {
  const taskItems = document.querySelectorAll('#taskList li');
  const taskInput = document.getElementById('taskInput');
  taskItems.forEach(item => item.classList.remove('focused'));
  if (focusedIndex >= 0 && focusedIndex < taskItems.length) {
    if (tasks[focusedIndex].lastStartedTime !== null) {
      toggleStart(focusedIndex); // Pause the timer when moving away
    }
    taskItems[focusedIndex].classList.add('focused');
    taskItems[focusedIndex].focus();
  } else if (focusedIndex === -1 || focusedIndex >= taskItems.length) {
    // If we've gone past the last item or to the input box, focus the input box
    taskInput.focus();
    // Ensure no task has the 'focused' class
    taskItems.forEach(item => item.classList.remove('focused'));
  } else if (taskItems.length > 0) {
    // If focusedIndex is out of bounds but there are tasks, focus on the last one
    focusedIndex = taskItems.length - 1;
    taskItems[focusedIndex].classList.add('focused');
    taskItems[focusedIndex].focus();
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
    focusedIndex = 0;
    updateFocus();
  }
}

function focusInputBox() {
  focusedIndex = -1;
  updateFocus();
}

// Function to log interactions
function logInteraction(action, index) {
  const task = tasks[index] || null; // Get the task or null if index is invalid
  console.log(`Action: ${action}`, { index, task });
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
      focusedIndex = tasks.length - 1;
      updateFocus();
      logInteraction('navigate', focusedIndex); // Log the action
      e.preventDefault();
    }
    return;
  }

  if (e.key === 'f') {
    toggleFullscreen();
    e.preventDefault();
  } else if (e.key === 'Escape') {
    focusFirstTask();
    e.preventDefault();
  } else if (document.activeElement === taskList || document.activeElement.closest('#taskList')) {
    switch(e.key) {
      case 'ArrowUp':
        if (focusedIndex > 0) {
          focusedIndex--;
          updateFocus();
          logInteraction('navigate', focusedIndex); // Log the action
        } else if (focusedIndex === 0) {
          // If at the first item, wrap to the input box
          focusInputBox();
        }
        e.preventDefault();
        break;
      case 'ArrowDown':
        focusedIndex = Math.min(tasks.length, focusedIndex + 1);
        updateFocus();
        logInteraction('navigate', focusedIndex); // Log the action
        e.preventDefault();
        break;
      case 'm':
        if (focusedIndex !== -1) {
          toggleMark(focusedIndex);
          logInteraction('mark', focusedIndex); // Log the action
        }
        break;
      case 'c':
        if (focusedIndex !== -1) {
          toggleComplete(focusedIndex);
          logInteraction('complete', focusedIndex); // Log the action
        }
        break;
      case 'n':
        focusInputBox();
        logInteraction('focusInput', focusedIndex); // Log the action
        e.preventDefault();
        break;
      case 'd':
        if (focusedIndex !== -1) {
          deleteTask(focusedIndex);
          logInteraction('delete', focusedIndex); // Log the action
          e.stopPropagation();
          e.preventDefault();
        }
        break;
      case 's':
        if (focusedIndex !== -1) {
          toggleStart(focusedIndex);
          logInteraction('start', focusedIndex); // Log the action
        }
        break;
      case 'h':
        toggleCompletedTasks();
        logInteraction('toggleCompletedTasks', focusedIndex); // Log the action
        break;
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
  const timestamp = new Date().toISOString().split('T')[0]; // Get YYYY-MM-DD format
  console.log('Timestamp:', timestamp); // Debug log

  const filename = `${timestamp}_FVP_tasks.json`;
  console.log('Filename:', filename); // Debug log

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tasks));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", filename); // Use the filename variable here
  console.log('Download attribute:', downloadAnchorNode.download); // Debug log

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
});

// Listen for changes to LocalStorage
window.addEventListener('storage', (event) => {
  if (event.key === 'tasks') {
    tasks = loadTasksFromLocalStorage();
    renderTasks();
  }
});

// New function to handle the start button click
function handleStartButtonClick(event, index) {
  event.stopPropagation(); // Prevent event bubbling
  event.preventDefault(); // Prevent default button behavior
  toggleStart(index); // Call the toggleStart function
}

// Function to update the displayed time for each task
function updateDisplayedTimes() {
  const taskList = document.getElementById('taskList');
  const taskItems = taskList.querySelectorAll('li');

  taskItems.forEach((item, index) => {
    const task = tasks[index];
    const stopwatch = item.querySelector('.stopwatch');
    if (stopwatch) {
      stopwatch.innerHTML = formatTime(getDisplayedTime(task));
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
  document.getElementById('cumulative-time').textContent = `Cumulative Work Time: ${formatCumulativeTime(cumulativeTimeInSeconds)}`;

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

// Function to edit task title
function editTaskTitle(index) {
  const task = tasks[index];
  const taskList = document.getElementById('taskList');
  const taskItem = taskList.children[index];
  const taskText = taskItem.querySelector('.task-text');

  const input = document.createElement('input');
  input.type = 'text';
  input.value = task.text;
  input.onblur = () => {
    task.text = input.value;
    saveTasksToLocalStorage(tasks);
    renderTasks();
  };
  input.onkeydown = (e) => {
    if (e.key === 'Enter') {
      input.blur();
    }
  };

  taskText.replaceWith(input);
  input.focus();
}

// Function to edit task cumulative time
function editTaskTime(index) {
  const task = tasks[index];
  const taskList = document.getElementById('taskList');
  const taskItem = taskList.children[index];
  const stopwatch = taskItem.querySelector('.stopwatch');

  const input = document.createElement('input');
  input.type = 'text';
  input.value = formatTime(getDisplayedTime(task));
  input.onblur = () => {
    const timeParts = input.value.split(':').map(Number);
    let newCumulativeTimeInSeconds = 0;

    if (timeParts.length === 3) {
      // Format: hh:mm:ss
      const [hours, mins, secs] = timeParts;
      if (!isNaN(hours) && !isNaN(mins) && !isNaN(secs)) {
        newCumulativeTimeInSeconds = hours * 3600 + mins * 60 + secs;
      }
    } else if (timeParts.length === 2) {
      // Format: mm:ss
      const [mins, secs] = timeParts;
      if (!isNaN(mins) && !isNaN(secs)) {
        newCumulativeTimeInSeconds = mins * 60 + secs;
      }
    }

    if (newCumulativeTimeInSeconds > 0) {
      if (task.lastStartedTime !== null) {
        // If the task is running, adjust the lastStartedTime to keep the timer accurate
        const elapsedTime = (Date.now() - task.lastStartedTime) / 1000;
        task.lastStartedTime = Date.now() - (newCumulativeTimeInSeconds - task.cumulativeTimeInSeconds - elapsedTime) * 1000;
      }
      task.cumulativeTimeInSeconds = newCumulativeTimeInSeconds;
      saveTasksToLocalStorage(tasks);
      renderTasks();
    } else {
      // If the input is invalid, revert to the original time
      renderTasks();
    }
  };
  input.onkeydown = (e) => {
    if (e.key === 'Enter') {
      input.blur();
    }
  };

  stopwatch.replaceWith(input);
  input.focus();
}
