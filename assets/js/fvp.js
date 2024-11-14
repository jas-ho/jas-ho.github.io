let tasks = [];
let focusedUUID = null;
let isFullscreenMode = false;
let isWorkMode = false;
console.log('Initial work mode:', isWorkMode);

let isDialogActive = false; // Flag to track dialog activity

function saveTasksToLocalStorage(tasks) {
  try {
    const key = isWorkMode ? 'workTasks' : 'privateTasks';
    console.log('Saving tasks to localStorage:', { key, taskCount: tasks.length });
    const serializedTasks = JSON.stringify(tasks);
    localStorage.setItem(key, serializedTasks);
    console.log('Tasks saved successfully');
  } catch (e) {
    console.error('Failed to save tasks:', e);
    if (e.name === 'QuotaExceededError') {
      alert('Storage limit exceeded. Please delete some tasks.');
    } else {
      console.error('Failed to save tasks:', e);
    }
  }
}

function loadTasksFromLocalStorage() {
  try {
    const key = isWorkMode ? 'workTasks' : 'privateTasks';
    console.log('Loading tasks from localStorage:', { key });
    const serializedTasks = localStorage.getItem(key);
    if (serializedTasks) {
      const loadedTasks = JSON.parse(serializedTasks);
      if (Array.isArray(loadedTasks)) {
        loadedTasks.forEach(task => {
          if (!task.uuid) task.uuid = generateUUID();
          if (task.startTime === undefined) task.startTime = null;
          if (task.endTime === undefined) task.endTime = null;
          if (task.firstStartedTime === undefined) task.firstStartedTime = null;
        });
        console.log('Tasks loaded successfully:', { taskCount: loadedTasks.length });
        return loadedTasks;
      }
    }
    console.log('No tasks found in localStorage');
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
  // if there are no completed tasks, alert the user using a modal (todo)
  if (tasks.filter(task => task.completed).length === 0) {
    // showModal('No completed tasks to clear.');
    alert('No completed tasks to clear.');  // todo: replace with modal
    return;
  }
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
    li.setAttribute('draggable', 'true'); // Make the task draggable

    // Extract the most recent "Definition of Done" from comments
    let definitionOfDone = '';
    if (task.comments && task.lastStartedTime !== null) {
      const dodMatch = task.comments.match(/Definition of Done:\s*([\s\S]+?)(?=\n\n|$)/);
      if (dodMatch) {
        definitionOfDone = dodMatch[1].trim().replace(/\n/g, '<br>');
      }
    }

    li.innerHTML = `
    <div class="task-container">
      <span class="task-text" ondblclick="editTaskTitle('${task.uuid}')">${task.text}</span>
      ${definitionOfDone ? `<div class="definition-of-done">${definitionOfDone}</div>` : ''}
    </div>
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
      deferred: false,
      firstStartedTime: null
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
  showOverlay();
  const task = findTaskByUUID(uuid);
  if (task) {
    // Stop the task to ensure cumulative time is up-to-date and restart immediately to account for reflection time
    stopTask(task);
    startTask(task);

    const elapsedTime = Math.ceil(task.cumulativeTimeInSeconds / 60);

    // Check if userAgentData is available
    const isMac = navigator.userAgentData ?
        navigator.userAgentData.platform.toUpperCase().indexOf('MAC') >= 0 :
        navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    const modifierKey = isMac ? '⌘' : 'Ctrl';

    const dialog = document.createElement('div');
    dialog.classList.add('reflection-dialog');

    // Format existing comments for display, excluding the "Start Reflection" line
    const existingComments = task.comments
      ? task.comments.split('\n').filter(line => !line.includes('Start Reflection')).join('<br>')
      : '';

    dialog.innerHTML = `
      ${existingComments ? `
        <div class="existing-comments">
          <h4>Previous Comments:</h4>
          <div class="comments-content">${existingComments}</div>
        </div>
      ` : ''}
      <p style="font-weight: bold; color: #333;">You worked on "${task.text}" for ${elapsedTime} min. How did it go?</p>
      <textarea id="reflection-input" placeholder="Enter your reflection here..." rows="3"></textarea>
      <div class="dialog-actions">
        <button id="complete-task-btn">Complete task now (Enter)</button>
        <button id="shelve-task-btn">Shelve task for later (${modifierKey}+Enter)</button>
        <button id="cancel-btn">Cancel (Esc)</button>
      </div>
    `;

    setupDialog(dialog);
    styleDialog(dialog);

    const input = dialog.querySelector('#reflection-input');
    input.style.cssText = `
      width: 100%;
      padding: 8px;
      margin: 10px 0;
      border: 1px solid var(--border-color, #ccc);
      border-radius: 4px;
      font-size: 16px;
      background-color: var(--main-bg, #fff);
      color: var(--text-color, #000);
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
      if (e.key === 'Enter' && !e.shiftKey) {
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
    task.comments = (task.comments || '') + (task.comments ? `\n` : '') + `[${timestamp}] End Reflection: ${reflection}`;
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
  if (task.deferred) {
    // deferring a task should unmark it
    task.marked = false;
  }
  saveTasksToLocalStorage(tasks);
  renderTasks();
  logInteraction('toggleDeferred', uuid);
  console.log('deferral status:', task.deferred);
}

function setupDialog(dialog) {
  const container = isFullscreenMode ? document.getElementById('fvp-container') : document.body;
  container.appendChild(dialog);
  dialog.dataset.container = isFullscreenMode ? 'fvp-container' : 'body';
  return container;
}

function styleDialog(dialog) {
  dialog.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--main-bg, #fff);
    color: var(--text-color, #000);
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    border: 1px solid var(--border-color, #ccc);
    z-index: 1001;
    width: 90%;
    max-width: 800px;
  `;
  return dialog;
}

function closeDialog(dialog) {
  const containerType = dialog.dataset.container;
  const container = containerType === 'fvp-container' ? document.getElementById('fvp-container') : document.body;
  if (container.contains(dialog)) {
    container.removeChild(dialog);
  }
  hideOverlay();
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
  console.log('Starting task: ', task);

  // Check if the task has any logged time
  if (task.cumulativeTimeInSeconds > 0) {
    // If time is already logged, start the task without showing the reflection dialog
    proceedToStartTask(task);
  } else {
    // Show reflection dialog before actually starting the task
    showStartReflectionDialog(task, () => {
      proceedToStartTask(task);
    });
  }
}

function proceedToStartTask(task) {
  // Stop all other running tasks
  tasks.forEach(t => {
    if (t.lastStartedTime !== null && t.uuid !== task.uuid) {
      stopTask(t);
    }
  });

  if (task.lastStartedTime === null) {
    const now = Date.now();
    task.lastStartedTime = now;
    task.startTime = now;
    if (task.firstStartedTime === null) {
      task.firstStartedTime = now;
    }
    console.log('started task', task.uuid);
  }

  saveTasksToLocalStorage(tasks);
  renderTasks();
  console.log('Task started:', task);
}

function showStartReflectionDialog(task, onComplete) {
  showOverlay();
  const dialog = document.createElement('div');
  dialog.classList.add('reflection-dialog');
  isDialogActive = true; // Set flag to true when dialog is shown

  // Consolidate all dialog styles into a single style block
  const style = document.createElement('style');
  style.textContent = `
    .reflection-dialog {
      max-height: 80vh;
      overflow-y: auto;
    }

    .reflection-dialog .existing-comments {
      margin-bottom: 1em;
      max-height: 200px;
      overflow-y: auto;
      padding: 0.5em;
      border: 1px solid var(--border-color);
      border-radius: 4px;
    }

    .reflection-dialog .input-group {
      margin-bottom: 1em;
    }

    .reflection-dialog label {
      display: block;
      margin-bottom: 0.5em;
    }

    .reflection-dialog textarea,
    .reflection-dialog input {
      width: 100%;
      padding: 0.5em;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background: var(--main-bg);
      color: var(--text-color);
    }
  `;
  dialog.appendChild(style);

  // Format existing comments for display
  const existingComments = task.comments ? task.comments.split('\n').join('<br>') : '';

  dialog.innerHTML = `
    <h3>Starting: ${task.text}</h3>
    ${existingComments ? `
      <div class="existing-comments">
        <h4>Previous Comments:</h4>
        <div class="comments-content">${existingComments}</div>
      </div>
    ` : ''}
    <div class="reflection-inputs">
      <div class="input-group">
        <label for="definition-of-done">Definition of Done:</label>
        <textarea id="definition-of-done" rows="2" placeholder="What needs to be true for this task to be complete?"></textarea>
      </div>
      <div class="input-group">
        <label for="expected-duration">Expected Duration (minutes):</label>
        <input type="number" id="expected-duration" min="1" step="1">
      </div>
    </div>
    <div class="dialog-actions">
      <button id="start-task-btn">Start Task (Enter)</button>
      <button id="cancel-btn">Cancel (Esc)</button>
    </div>
  `;

  setupDialog(dialog);
  styleDialog(dialog);

  const handleStart = () => {
    const dod = document.getElementById('definition-of-done').value.trim();
    const duration = document.getElementById('expected-duration').value;

    if (dod || duration) {
      const timestamp = formatDateTime(Date.now());
      const newComment = `[${timestamp}] Start Reflection:\n` +
        (dod ? `Definition of Done: ${dod}\n` : '') +
        (duration ? `Expected Duration: ${duration} minutes\n` : '');

      task.comments = (task.comments || '') + (task.comments ? '\n' : '') + newComment;
    }

    closeDialog(dialog);
    onComplete();
    isDialogActive = false; // Reset flag when dialog is closed
  };

  const handleCancel = () => {
    closeDialog(dialog);
    isDialogActive = false; // Reset flag when dialog is closed
  };

  function handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleStart();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  }

  dialog.addEventListener('keydown', handleKeydown);
  document.getElementById('start-task-btn').addEventListener('click', handleStart);
  document.getElementById('cancel-btn').addEventListener('click', handleCancel);

  // Focus the first input
  setTimeout(() => {
    document.getElementById('definition-of-done').focus();
  }, 0);
}

function stopTask(task) {
  if (task.lastStartedTime !== null) {
    task.cumulativeTimeInSeconds += (Date.now() - task.lastStartedTime) / 1000;
    task.lastStartedTime = null;
    task.endTime = Date.now();
    console.log('stopped task', task.uuid);

    // Save and render after stopping the task
    saveTasksToLocalStorage(tasks);
    renderTasks();
  }
}

// Update toggleStart to use startTask and stopTask directly
function toggleStart(uuid) {
  const task = findTaskByUUID(uuid);
  if (task) {
    if (task.lastStartedTime === null) {
      startTask(task);
    } else {
      stopTask(task);
    }

    setFocus(uuid);
    logInteraction('toggleStart', uuid);
  }
}

// Update finalizePreselection to call startTask directly
function finalizePreselection() {
  console.log('Finalizing Preselection');
  const currentBenchmarkTask = getCurrentBenchmarkTask();
  if (currentBenchmarkTask) {
    console.log('Top Priority Task:', currentBenchmarkTask);

    // Ensure the task is marked
    if (!currentBenchmarkTask.marked) {
      toggleMark(currentBenchmarkTask.uuid);
    }

    // Use Promise to ensure operations are performed in order
    Promise.resolve()
      .then(() => {
        // Start the task
        // return new Promise(resolve => {
        //   startTask(currentBenchmarkTask);
        //   resolve();
        // });
      })
      .then(() => {
        // Set focus
        setFocus(currentBenchmarkTask.uuid);
      })
      .then(() => {
        // Render tasks to update the UI
        renderTasks();
      })
      .then(() => {
        // Ensure focus is set after rendering
        setTimeout(() => {
          setFocus(currentBenchmarkTask.uuid);
        }, 50);
      })
      .catch(error => {
        console.error('Error in finalizePreselection:', error);
      });
  } else {
    console.log('No tasks to execute.');
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

function toggleFullscreen(forceState) {
  const container = document.getElementById('fvp-container');
  const fullscreenToggle = document.getElementById('fullscreen-toggle');

  // If forceState is provided, use it; otherwise, toggle the current state
  isFullscreenMode = forceState !== undefined ? forceState : !container.classList.contains('fullscreen');

  container.classList.toggle('fullscreen', isFullscreenMode);

  // Update the icon and title
  fullscreenToggle.innerHTML = `<i data-feather="${isFullscreenMode ? 'minimize' : 'maximize'}"></i>`;
  fullscreenToggle.title = isFullscreenMode ? 'Exit Fullscreen' : 'Enter Fullscreen';

  // Hide/show the sidebar and other page elements
  const sidebar = document.querySelector('.sidebar');
  const content = document.querySelector('.content');
  if (sidebar) sidebar.style.display = isFullscreenMode ? 'none' : '';
  if (content) content.style.width = isFullscreenMode ? '100%' : '';

  // Show/hide the inner title
  const innerTitle = container.querySelector('h1');
  if (innerTitle) innerTitle.style.display = isFullscreenMode ? 'block' : 'none';

  // Adjust container position and size for fullscreen mode
  if (isFullscreenMode) {
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100vw';
    container.style.height = '100vh';
    container.style.zIndex = '9999';
  } else {
    container.style.position = '';
    container.style.top = '';
    container.style.left = '';
    container.style.width = '';
    container.style.height = '';
    container.style.zIndex = '';
  }

  // Replace the Feather icon
  feather.replace();
}

// Remove the existing event listener
document.getElementById('fullscreen-toggle').removeEventListener('click', toggleFullscreen);

// Add a new event listener that doesn't pass any arguments
document.getElementById('fullscreen-toggle').addEventListener('click', () => toggleFullscreen());


function focusFirstTask() {
  if (tasks.length > 0) {
    focusedUUID = tasks[0].uuid;
    updateFocus();
  }
}

function focusInputBox() {
  const taskInput = document.getElementById('taskInput');
  focusedUUID = null;
  updateFocus();
  taskInput.focus();
}

function logInteraction(action, uuid) {
  const task = findTaskByUUID(uuid) || null;
  console.log(`Action: ${action}`, { uuid, task });
}

document.addEventListener('keydown', function(e) {
  if (isDialogActive) return; // Skip processing if dialog is active

  const taskList = document.getElementById('taskList');
  const taskInput = document.getElementById('taskInput');

  // Check if any modifier key is pressed
  const isModifierPressed = e.ctrlKey || e.metaKey || e.altKey || e.shiftKey;

  // Check if the active element is any input field
  if (document.activeElement === taskInput) {
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
    return; // Exit early if the input box is focused
  }

  // Only process single-key shortcuts if no modifier is pressed
  if (!isModifierPressed) {
    switch (e.key) {
      case 'f': // Toggle Fullscreen
        toggleFullscreen();
        e.preventDefault();
        break;
      case 'h': // Hide / Show Completed
        toggleCompletedTasks();
        console.log('toggleCompletedTasks');
        e.preventDefault();
        break;
      case 'p': // Initiate Preselection
        initiatePreselection();
        console.log('initiatePreselection');
        e.preventDefault();
        break;
      case 'n': // Focus Input Box to add new task
        focusInputBox();
        console.log('focusInput');
        e.preventDefault();
        break;
      case 'Escape': // Move Focus to First Task
        focusFirstTask();
        e.preventDefault();
        break;
    }
  }

  if (document.activeElement === taskList || document.activeElement.closest('#taskList')) {
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
    } else if (e.key === 'Enter') {
      // Enter "edit task title" mode when Enter is pressed
      if (focusedUUID) {
        editTaskTitle(focusedUUID);
        e.preventDefault();
      }
    } else if (!isModifierPressed) {
      // Only process these shortcuts if no modifier is pressed
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

document.getElementById('export-btn').addEventListener('click', async function() {
  const timestamp = new Date().toISOString().split('T')[0];
  const modePrefix = isWorkMode ? 'work' : 'private';
  const defaultFilename = `${timestamp}_FVP_${modePrefix}_tasks.json`;
  const jsonString = JSON.stringify(tasks, null, 2);

  if ('showSaveFilePicker' in window) {
    try {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: defaultFilename,
        types: [{
          description: 'JSON Files',
          accept: {'application/json': ['.json']},
        }],
      });

      const writable = await fileHandle.createWritable();
      await writable.write(jsonString);
      await writable.close();

      console.log('File saved successfully using File System Access API');
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Failed to save file:', err);
        fallbackSaveMethod(jsonString, defaultFilename);
      }
    }
  } else {
    fallbackSaveMethod(jsonString, defaultFilename);
  }
});

function fallbackSaveMethod(content, filename) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  console.log('File saved successfully using fallback method');
}

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
          // Ensure each imported task has required properties
          importedTasks.forEach(task => {
            if (task.startTime === undefined) task.startTime = null;
            if (task.endTime === undefined) task.endTime = null;
            if (!task.uuid) task.uuid = generateUUID(); // Ensure unique UUIDs
          });

          // Append imported tasks to existing tasks
          tasks = tasks.concat(importedTasks);
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
  console.log('DOMContentLoaded event fired');

  // Set initial container class
  const container = document.getElementById('fvp-container');
  if (container) {
    container.classList.toggle('work-mode', isWorkMode);
  }

  console.log('Initial mode:', isWorkMode ? 'work' : 'private');

  tasks = loadTasksFromLocalStorage();
  renderTasks();
  startUpdatingTime();
  document.getElementById('taskList').focus();
  feather.replace();
  updateToggleCompletedButton();
  toggleFullscreen(true); // Set fullscreen mode by default

  const taskList = document.getElementById('taskList');

  taskList.addEventListener('dragstart', (e) => {
    if (e.target.tagName === 'LI') {
      e.dataTransfer.setData('text/plain', e.target.dataset.taskUuid);
    }
  });

  taskList.addEventListener('dragover', (e) => {
    e.preventDefault();
    const afterElement = getDragAfterElement(taskList, e.clientY);
    const draggable = document.querySelector('.dragging');
    if (afterElement == null) {
      taskList.appendChild(draggable);
    } else {
      taskList.insertBefore(draggable, afterElement);
    }
  });

  taskList.addEventListener('drop', (e) => {
    e.preventDefault();
    const uuid = e.dataTransfer.getData('text/plain');
    const draggedTask = findTaskByUUID(uuid);
    const afterElement = getDragAfterElement(taskList, e.clientY);
    const afterUUID = afterElement ? afterElement.dataset.taskUuid : null;
    reorderTasks(draggedTask, afterUUID);
    saveTasksToLocalStorage(tasks);
    renderTasks();
  });

  function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('li:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  function reorderTasks(draggedTask, afterUUID) {
    const draggedIndex = tasks.indexOf(draggedTask);
    tasks.splice(draggedIndex, 1);
    const afterIndex = afterUUID ? tasks.findIndex(task => task.uuid === afterUUID) : tasks.length;
    tasks.splice(afterIndex, 0, draggedTask);
  }

});

// Update the storage event listener to use the correct key
window.addEventListener('storage', (event) => {
  const relevantKey = isWorkMode ? 'workTasks' : 'privateTasks';
  if (event.key === relevantKey) {
    tasks = loadTasksFromLocalStorage();
    renderTasks();
  }
});

// Add a direct event listener outside of DOMContentLoaded
document.addEventListener('click', function(event) {
  if (event.target.closest('#mode-toggle')) {
    console.log('Mode toggle clicked');
    toggleMode();
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
  const cumulativeTimeInSeconds = tasks.reduce((total, task) => total + getDisplayedTime(task), 0);

  // Add mode indicator using UTF symbols
  const modeSymbol = isWorkMode ? '💼' : '🏠';  // Alternatively: '⚡' : '♥' or '📊' : '🎯'
  document.getElementById('cumulative-time').textContent =
    `${modeSymbol} | Cumulative Time: ${formatCumulativeTime(cumulativeTimeInSeconds)} | Completed: ${completedTasks} | Total: ${totalTasks}`;

  if (progressBar) {
    progressBar.style.width = totalTasks > 0 ? `${(completedTasks / totalTasks) * 100}%` : '0%';
    progressBar.setAttribute('data-hover', `${completedTasks} out of ${totalTasks} tasks completed`);
  }
}

// Call this function to start updating the time every second
function startUpdatingTime() {
  setInterval(() => {
    updateDisplayedTimes();
    updateProgressBar(); // Update progress bar and cumulative work time every second
  }, 1000); // Update every second
}

function showOverlay() {
  const container = isFullscreenMode ? document.getElementById('fvp-container') : document.body;
  const overlay = document.createElement('div');
  overlay.id = 'fvp-overlay';
  overlay.style.cssText = `
    position: ${isFullscreenMode ? 'absolute' : 'fixed'};
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: var(--main-bg);
    z-index: 999;
  `;
  container.appendChild(overlay);
}

function hideOverlay() {
  const overlay = document.getElementById('fvp-overlay');
  if (overlay) {
    overlay.remove();
  }
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
  input.className = 'edit-task-input'; // Add a class for styling

  // Set the input width to match the task text width
  input.style.width = `${taskText.offsetWidth}px`; // Match the width of the task text

  input.onblur = function() {
    finishEditing(task, input);
  };
  input.onkeydown = function(e) {
    if (e.key === 'Enter') {
      finishEditing(task, input);
    } else if (e.key === 'Escape') {
      taskText.replaceWith(taskText); // Cancel editing
    }
  };
  taskText.replaceWith(input);
  input.focus();
  input.select(); // Select all text in the input
}

function finishEditing(task, input) {
  task.text = input.value;
  saveTasksToLocalStorage(tasks);
  renderTasks();
  setFocus(task.uuid); // Ensure focus is maintained on the task
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

  // Match the font size, padding, and border of the stopwatch
  const computedStyle = window.getComputedStyle(stopwatch);
  const fontSize = parseFloat(computedStyle.fontSize) * 0.9; // Decrease font size by 10%
  input.style.fontSize = `${fontSize}px`;
  input.style.padding = computedStyle.padding;
  input.style.border = computedStyle.border;
  input.style.boxSizing = 'border-box'; // Ensure padding and border are included in the width

  // Set the input width dynamically based on its content
  input.style.width = `${input.value.length + 1}ch`; // Set width based on character count

  input.oninput = function() {
    input.style.width = `${input.value.length + 1}ch`; // Adjust width as user types
  };

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
  input.setSelectionRange(0, 0); // Set cursor to the start of the input
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
    currentBenchmarkTask = tasks.find(task => !task.completed && !task.deferred);
    if (currentBenchmarkTask) {
      toggleMark(currentBenchmarkTask.uuid);
    } else {
      console.log('No uncompleted tasks available');
      return;
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
      if (!nextConsideredTask) {
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
  showOverlay();
  const dialog = document.createElement('div');
  dialog.classList.add('comparison-dialog');

  dialog.innerHTML = `
    <p>Which task do you prefer to do next?</p>
    <div class="task-comparison">
      <div class="task-item">
        <button class="task-option" id="choose-benchmark" title="Select Task">
          <i data-feather="play"></i>
          <span class="task-text">
            ${benchmarkTask ? benchmarkTask.text : 'No benchmark task'}
          </span>
        </button>
        <button class="defer-btn" id="defer-benchmark" title="Defer">
          <i data-feather="chevron-right"></i>
        </button>
      </div>
      <div class="task-item">
        <button class="task-option" id="choose-next" title="Select Task">
          <i data-feather="play"></i>
          <span class="task-text">
            ${nextConsideredTask.text}
          </span>
        </button>
        <button class="defer-btn" id="defer-next" title="Defer">
          <i data-feather="chevron-right"></i>
        </button>
      </div>
    </div>
  `;

  setupDialog(dialog);
  styleDialog(dialog);

  // Restore styles for the task comparison elements
  const style = document.createElement('style');
  style.textContent = `
    .task-comparison { width: 100%; }
    .task-item { display: flex; align-items: center; margin-bottom: 15px; width: 100%; }
    .task-option { display: flex; align-items: center; background: none; border: none; cursor: pointer; padding: 5px; width: 100%; }
    .task-option i { width: 18px; height: 18px; margin-right: 10px; }
    .task-text { flex-grow: 1; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .defer-btn { background: none; border: none; cursor: pointer; padding: 5px; }
    .defer-btn i { width: 18px; height: 18px; }
  `;
  dialog.appendChild(style);

  // Replace feather icons
  feather.replace({ 'width': 18, 'height': 18 });

  function handleChooseBenchmark() {
    closeDialog(dialog);
    hideOverlay();
    initiatePreselection(nextConsideredTask);
  }

  function handleChooseNext() {
    if (!nextConsideredTask.marked) {
      toggleMark(nextConsideredTask.uuid);
    }
    closeDialog(dialog);
    hideOverlay();
    initiatePreselection(nextConsideredTask);
  }

  function handleDeferBenchmark() {
    toggleDeferred(benchmarkTask.uuid);
    handleChooseNext();
  }

  function handleDeferNext() {
    toggleDeferred(nextConsideredTask.uuid);
    handleChooseBenchmark();
  }

  function handleChooseCancel() {
    closeDialog(dialog);
    hideOverlay();
    finalizePreselection();
  }

  function handleKeydown(e) {
    // Check if the dialog is currently in the DOM
    if (!document.body.contains(dialog)) return;

    if (e.key === '1') {
      e.preventDefault();
      handleChooseBenchmark();
    } else if (e.key === '2') {
      e.preventDefault();
      handleChooseNext();
    } else if (e.key === '0') {
      e.preventDefault();
      handleDeferNext();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleChooseCancel();
    }
  }

  document.addEventListener('keydown', handleKeydown);

  document.getElementById('choose-benchmark').addEventListener('click', handleChooseBenchmark);
  document.getElementById('choose-next').addEventListener('click', handleChooseNext);
  document.getElementById('defer-benchmark').addEventListener('click', handleDeferBenchmark);
  document.getElementById('defer-next').addEventListener('click', handleDeferNext);

  dialog.addEventListener('DOMNodeRemoved', () => {
    document.removeEventListener('keydown', handleKeydown);
  });

  console.log('Comparing Tasks:', { benchmarkTask, nextConsideredTask });
}


document.getElementById('preselection-btn').addEventListener('click', function() {
  initiatePreselection();
});

function toggleMode() {
  console.log('Toggling mode. Current mode:', isWorkMode ? 'work' : 'private');

  // Stop any running tasks before switching modes
  tasks.forEach(task => {
    if (task.lastStartedTime !== null) {
      console.log('Stopping running task:', task);
      stopTask(task);
    }
  });

  // Save current tasks before switching
  console.log('Saving current tasks before switch:', tasks);
  saveTasksToLocalStorage(tasks);

  // Toggle mode and update UI
  isWorkMode = !isWorkMode;
  console.log('Switched to:', isWorkMode ? 'work' : 'private', 'mode');

  // Update container class directly
  const container = document.getElementById('fvp-container');
  if (container) {
    container.classList.toggle('work-mode', isWorkMode);
  }

  // Load tasks for new mode
  tasks = loadTasksFromLocalStorage();
  console.log('Loaded tasks for new mode:', tasks);

  // Update UI
  renderTasks();
  console.log('UI updated for new mode');
}

// Add event listener to the input box to ensure focus
document.getElementById('taskInput').addEventListener('focus', focusInputBox);


