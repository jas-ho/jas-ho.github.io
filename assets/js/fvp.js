let tasks = [];
let focusedUUID = null;

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

  // Function to generate a UUIDv4
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0; // Generate a random number between 0 and 15
      const v = c === 'x' ? r : (r & 0x3 | 0x8); // Set the version to 4
      return v.toString(16); // Convert to hexadecimal
    });
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
        <button class="start-btn" onclick="handleStartButtonClick(event, '${task.uuid}')" title="Start">${task.lastStartedTime !== null ? '⏸' : '▶'}</button>
        <button class="mark-btn" onclick="toggleMark('${task.uuid}')" title="Mark">★</button>
        <button class="complete-btn" onclick="toggleComplete('${task.uuid}')" title="${task.completed ? 'Reopen' : 'Complete'}">✓</button>
        <button class="delete-btn" onclick="deleteTask('${task.uuid}')" title="Delete">×</button>
      </div>
    `;
    li.setAttribute('tabindex', '0');
    li.onclick = () => setFocus(task.uuid);
    if (task.marked) li.classList.add('marked');
    if (task.completed) li.classList.add('completed');
    if (task.lastStartedTime !== null) li.classList.add('running');
    if (task === lastMarkedTask) li.classList.add('last-marked'); // Highlight the last marked task
    if (task.uuid === focusedUUID) li.classList.add('focused');
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
      uuid: generateUUID(), // Assign a UUID
      text: input.value,
      marked: false,
      completed: false,
      cumulativeTimeInSeconds: 0,
      lastStartedTime: null,
      startTime: null, // Add startTime property
      endTime: null, // Add endTime property
      parentUUID: null // Set parentUUID to null for new tasks
    };
    tasks.push(newTask);
    input.value = '';
    saveTasksToLocalStorage(tasks);
    renderTasks();
    input.focus();
    logInteraction('addTask', newTask.uuid); // Log the action
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
  if (task) {
    task.completed = !task.completed;
    if (task.completed) {
      if (task.lastStartedTime !== null) {
        toggleStart(uuid); // Stop timer
      }
      task.endTime = Date.now();
      promptForReflection(uuid);
    } else {
      task.endTime = null;
    }
    saveTasksToLocalStorage(tasks);
    renderTasks();
    setFocus(uuid);
    logInteraction('toggleComplete', uuid);
  }
}

function promptForReflection(uuid) {
  const task = findTaskByUUID(uuid);
  if (task) {
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
      saveReflection(uuid, document.getElementById('reflection-input').value);
      closeDialog(dialog);
    });

    document.getElementById('shelve-task-btn').addEventListener('click', () => {
      saveReflection(uuid, document.getElementById('reflection-input').value);
      shelveTask(uuid);
      closeDialog(dialog);
    });

    document.getElementById('cancel-btn').addEventListener('click', () => {
      task.completed = false; // Revert task to incomplete status
      saveTasksToLocalStorage(tasks);
      renderTasks();
      closeDialog(dialog);
    });
  }
}

function saveReflection(uuid, reflection) {
  const task = findTaskByUUID(uuid);
  if (task) {
    const timestamp = formatDateTime(Date.now()); // Get current timestamp in the new format
    task.comments = (task.comments || '') + (task.comments ? `\n` : '') + `[${timestamp}] Reflection: ${reflection}`;
    saveTasksToLocalStorage(tasks);
    renderTasks();
  }
}

function shelveTask(uuid) {
  const task = findTaskByUUID(uuid);
  if (task) {
    const timestamp = formatDateTime(Date.now()); // Get current timestamp in the new format

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

function closeDialog(dialog) {
  document.body.removeChild(dialog);
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
    logInteraction('deleteTask', uuid); // Log the action
  }
}

let isToggling = false;

function toggleStart(uuid) {
  const task = findTaskByUUID(uuid);
  if (task) {
    if (isToggling) return; // Prevent multiple triggers
    isToggling = true;

    if (task.lastStartedTime === null) {
      task.lastStartedTime = Date.now();
      if (task.startTime === null) {
        task.startTime = task.lastStartedTime;
      }
    } else {
      task.cumulativeTimeInSeconds += (Date.now() - task.lastStartedTime) / 1000;
      task.lastStartedTime = null;
    }
    saveTasksToLocalStorage(tasks);
    renderTasks();
    setFocus(uuid);
    logInteraction('toggleStart', uuid); // Log the action

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

// Function to log interactions
function logInteraction(action, uuid) {
  const task = findTaskByUUID(uuid) || null; // Get the task or null if uuid is invalid
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

  if (e.key === 'f') {
    toggleFullscreen();
    e.preventDefault();
  } else if (e.key === 'Escape') {
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
        case 'm':
          if (focusedUUID) {
            toggleMark(focusedUUID);
            logInteraction('mark', focusedUUID); // Log the action
          }
          break;
        case 'c':
          if (focusedUUID) {
            toggleComplete(focusedUUID);
            logInteraction('complete', focusedUUID); // Log the action
          }
          break;
        case 'n':
          focusInputBox();
          logInteraction('focusInput', focusedUUID); // Log the action
          e.preventDefault();
          break;
        case 'd':
          if (focusedUUID) {
            deleteTask(focusedUUID);
            logInteraction('delete', focusedUUID); // Log the action
            e.stopPropagation();
            e.preventDefault();
          }
          break;
        case 's':
          if (focusedUUID) {
            toggleStart(focusedUUID);
            logInteraction('start', focusedUUID); // Log the action
          }
          break;
        case 'h':
          toggleCompletedTasks();
          logInteraction('toggleCompletedTasks', focusedUUID); // Log the action
          break;
        case 'p':
          initiatePreselection();
          e.preventDefault();
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
function handleStartButtonClick(event, uuid) {
  event.stopPropagation(); // Prevent event bubbling
  event.preventDefault(); // Prevent default button behavior
  toggleStart(uuid); // Call the toggleStart function
}

// Function to update the displayed time for each task
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

// Function to edit task title
function editTaskTitle(uuid) {
  const task = findTaskByUUID(uuid);
  if (!task) return; // Handle case where task is not found

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

// Function to edit task cumulative time
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

// Helper function to find a task by UUID
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
  const nextUncompletedTask = tasks.slice(startIndex).find(t => !t.completed);
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
    </div>
  `;
  document.body.appendChild(dialog);

  // Set the width of the comparison dialog to match the task list
  const taskList = document.getElementById('taskList');
  if (taskList) {
    const taskListWidth = taskList.offsetWidth;
    dialog.style.width = `${taskListWidth}px`;
  }

  // Add event listeners for the buttons
  document.getElementById('choose-benchmark').addEventListener('click', () => {
    closeDialog(dialog);
    // Continue with the next uncompleted task after the current benchmark task
    initiatePreselection(nextConsideredTask);
  });

  document.getElementById('choose-next').addEventListener('click', () => {
    if (!nextConsideredTask.marked) {
      toggleMark(nextConsideredTask.uuid);
    }
    closeDialog(dialog);
    initiatePreselection(nextConsideredTask);
  });

  // Add keyboard shortcuts for task selection
  document.addEventListener('keydown', function(e) {
    if (e.key === '1') {
      document.getElementById('choose-benchmark').click();
    } else if (e.key === '2') {
      document.getElementById('choose-next').click();
    } else if (e.key === 'Escape') {
      const dialog = document.querySelector('.comparison-dialog');
      if (dialog) {
        closeDialog(dialog);
        finalizePreselection();
      }
    }
  });

  console.log('Comparing Tasks:', { benchmarkTask, nextConsideredTask });
}

// Function to close the comparison dialog
function closeDialog(dialog) {
  document.body.removeChild(dialog);
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
