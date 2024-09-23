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
        return tasks;
      }
    }
  } catch (e) {
    console.error('Failed to load tasks:', e);
  }
  return [];
}

function renderTasks() {
  const taskList = document.getElementById('taskList');
  taskList.innerHTML = '';
  let lastMarkedIndex = tasks.findLastIndex(task => task.marked && !task.completed);
  tasks.forEach((task, index) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="task-text">${task.text}</span>
      <div class="controls">
        <button class="mark-btn" onclick="toggleMark(${index})" title="Mark">★</button>
        <button class="complete-btn" onclick="toggleComplete(${index})" title="${task.completed ? 'Reopen' : 'Complete'}">✓</button>
        <button class="delete-btn" onclick="deleteTask(${index})" title="Delete">×</button>
      </div>
    `;
    li.setAttribute('tabindex', '0');
    li.onclick = () => setFocus(index);
    if (task.marked) li.classList.add('marked');
    if (task.completed) li.classList.add('completed');
    if (index === lastMarkedIndex) li.classList.add('last-marked');
    if (index === focusedIndex) li.classList.add('focused');
    taskList.appendChild(li);
  });

  // If the task list is empty, focus on the input box
  if (tasks.length === 0) {
    focusInputBox();
  }
}

function addTask(event) {
  event.preventDefault();
  const input = document.getElementById('taskInput');
  if (input.value) {
    tasks.push({ text: input.value, marked: false, completed: false });
    input.value = '';
    saveTasksToLocalStorage(tasks);
    renderTasks();
    // After adding a task, keep focus on the input box
    input.focus();
  }
}

function toggleMark(index) {
  tasks[index].marked = !tasks[index].marked;
  saveTasksToLocalStorage(tasks);
  renderTasks();
  // After rendering, we need to restore focus and update the focused item
  setFocus(index);
}

function toggleComplete(index) {
  tasks[index].completed = !tasks[index].completed;
  if (tasks[index].completed) {
    tasks[index].marked = false;
  }
  saveTasksToLocalStorage(tasks);
  renderTasks();
  // After rendering, restore focus to the same item
  setFocus(index);
}

function deleteTask(index) {
  tasks.splice(index, 1);
  saveTasksToLocalStorage(tasks);
  renderTasks();
  // After deletion, set focus to the previous item or the last item if we deleted the last one
  if (index > 0) {
    setFocus(index - 1);
  } else if (tasks.length > 0) {
    setFocus(0);
  } else {
    // If no tasks left, reset focusedIndex
    focusedIndex = -1;
  }
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
        } else if (focusedIndex === 0) {
          // If at the first item, wrap to the input box
          focusInputBox();
        }
        e.preventDefault();
        break;
      case 'ArrowDown':
        focusedIndex = Math.min(tasks.length, focusedIndex + 1);
        updateFocus();
        e.preventDefault();
        break;
      case 'm':
        if (focusedIndex !== -1) toggleMark(focusedIndex);
        break;
      case 'c':
        if (focusedIndex !== -1) toggleComplete(focusedIndex);
        break;
      case 'n':
        focusInputBox();
        e.preventDefault();
        break;
      case 'd':
        if (focusedIndex !== -1) {
          deleteTask(focusedIndex);
          e.stopPropagation();
          e.preventDefault();
        }
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
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tasks));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", "tasks.json");
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

// Load tasks when the page loads
document.addEventListener('DOMContentLoaded', () => {
  tasks = loadTasksFromLocalStorage();
  renderTasks();
  document.getElementById('taskList').focus();
});

// Listen for changes to LocalStorage
window.addEventListener('storage', (event) => {
  if (event.key === 'tasks') {
    tasks = loadTasksFromLocalStorage();
    renderTasks();
  }
});
