// ============================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ============================================
let score = 0;
let isVR = false;
let debugInterval = null;
let scene = null;
let camera = null;
let cursor = null;
let leftController = null;
let rightController = null;

// Элементы UI
const scoreEl = document.getElementById('score');
const container = document.getElementById('items-container');
const debugMode = document.getElementById('debug-mode');
const debugObjects = document.getElementById('debug-objects');
const debugCursor = document.getElementById('debug-cursor');
const debugIntersection = document.getElementById('debug-intersection');
const debugEvent = document.getElementById('debug-event');
const debugGrab = document.getElementById('debug-grab');

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================
document.addEventListener('DOMContentLoaded', function() {
  console.log('🔍 [1/7] DOM загружен');
  
  scene = document.querySelector('a-scene');
  
  if (scene.hasLoaded) {
    initGame();
  } else {
    console.log('⏳ [2/7] Ждём загрузки сцены...');
    scene.addEventListener('loaded', function() {
      console.log('✅ [3/7] Сцена загружена');
      initGame();
    });
  }
});

function initGame() {
  console.log('🎮 [4/7] Инициализация игры...');
  
  // Получаем элементы
  camera = document.getElementById('camera');
  cursor = document.getElementById('cursor');
  leftController = document.getElementById('left-controller');
  rightController = document.getElementById('right-controller');
  container = document.getElementById('items-container');
  
  // Проверка всех элементов
  console.log('📦 [5/7] Проверка элементов:');
  console.log('  - Камера:', camera ? '✅' : '❌');
  console.log('  - Курсор:', cursor ? '✅' : '❌');
  console.log('  - Левый контроллер:', leftController ? '✅' : '❌');
  console.log('  - Правый контроллер:', rightController ? '✅' : '❌');
  console.log('  - Контейнер:', container ? '✅' : '❌');
  
  // Проверка raycaster на курсоре
  if (cursor) {
    console.log('  - Курсор имеет raycaster:', cursor.components.raycaster ? '✅' : '❌');
    console.log('  - Курсор имеет cursor:', cursor.components.cursor ? '✅' : '❌');
  }
  
  // Слушаем вход/выход из VR
  scene.addEventListener('enter-vr', () => {
    isVR = true;
    debugMode.textContent = 'Режим: VR/AR 🥽';
    debugMode.style.color = '#00FFFF';
    console.log('🥽 Вход в VR');
  });
  
  scene.addEventListener('exit-vr', () => {
    isVR = false;
    debugMode.textContent = 'Режим: PC 💻';
    debugMode.style.color = '#00FF00';
    console.log('💻 Выход из VR');
  });
  
  // Настраиваем обработчики
  setupEventListeners();
  
  // Запускаем отладку
  startDebugLoop();
  
  // Создаем предметы
  console.log('📦 [6/7] Создаем предметы...');
  for(let i = 0; i < 8; i++) {
    spawnItem();
  }
  
  console.log('✅ [7/7] Игра готова!');
  console.log('👉 Наведите курсор на куб и кликните');
}

// ============================================
// ОБРАБОТЧИКИ СОБЫТИЙ
// ============================================
function setupEventListeners() {
  console.log('🔌 Настройка обработчиков...');
  
  // 1. Клик мышью по canvas
  const canvas = document.querySelector('canvas');
  if (canvas) {
    canvas.addEventListener('click', function(evt) {
      console.log('🖱️ Клик по canvas');
      debugEvent.textContent = 'Событие: Клик мыши';
      checkIntersectionAndGrab();
    });
  }
  
  // 2. Клавиши Q и E
  document.addEventListener('keydown', function(event) {
    const key = event.key.toLowerCase();
    
    if (key === 'q') {
      console.log('⌨️ Нажата Q');
      debugEvent.textContent = 'Событие: Q';
      if (leftController) {
        checkIntersectionAndGrab(leftController);
      }
    } else if (key === 'e') {
      console.log('⌨️ Нажата E');
      debugEvent.textContent = 'Событие: E';
      if (rightController) {
        checkIntersectionAndGrab(rightController);
      }
    }
  });
  
  // 3. Курсор - клик
  if (cursor) {
    cursor.addEventListener('click', function(evt) {
      console.log('🎯 Клик курсора');
      debugEvent.textContent = 'Событие: Клик курсора';
      if (evt.detail && evt.detail.el) {
        console.log('  - Целевой объект:', evt.detail.el.id);
        grabObject(evt.detail.el);
      } else {
        checkIntersectionAndGrab();
      }
    });
    
    cursor.addEventListener('mouseenter', function(evt) {
      if (evt.detail && evt.detail.el) {
        console.log('👆 Курсор на:', evt.detail.el.id);
        debugIntersection.textContent = 'Пересечение: ' + evt.detail.el.id;
      }
    });
    
    cursor.addEventListener('mouseleave', function() {
      debugIntersection.textContent = 'Пересечение: нет';
    });
  }
  
  // 4. Контроллеры VR
  if (leftController) {
    leftController.addEventListener('triggerdown', function() {
      console.log('🎮 Левый курок');
      debugEvent.textContent = 'Событие: Левый курок';
      checkIntersectionAndGrab(leftController);
    });
  }
  
  if (rightController) {
    rightController.addEventListener('triggerdown', function() {
      console.log('🎮 Правый курок');
      debugEvent.textContent = 'Событие: Правый курок';
      checkIntersectionAndGrab(rightController);
    });
  }
}

// ============================================
// ПРОВЕРКА ПЕРЕСЕЧЕНИЙ
// ============================================
function checkIntersectionAndGrab(source) {
  console.log('🔍 Проверка пересечений...', source ? source.id : 'курсор');
  
  let intersections = null;
  let sourceName = '';
  
  // Получаем raycaster из источника
  let raycasterComponent = null;
  
  if (source && source.components && source.components.raycaster) {
    raycasterComponent = source.components.raycaster;
    sourceName = source.id;
  } else if (cursor && cursor.components && cursor.components.raycaster) {
    raycasterComponent = cursor.components.raycaster;
    sourceName = 'cursor';
  }
  
  if (!raycasterComponent) {
    console.error('❌ Raycaster не найден!');
    debugIntersection.textContent = 'Raycaster: НЕ НАЙДЕН';
    return;
  }
  
  // Получаем все объекты с классом grabbable
  const grabbableObjects = document.querySelectorAll('.grabbable');
  console.log('  - Найдено объектов .grabbable:', grabbableObjects.length);
  
  // Проверяем каждый объект
  grabbableObjects.forEach((obj, index) => {
    console.log('  - Объект ' + index + ':', obj.id, 'Классы:', obj.className);
  });
  
  // Получаем пересечения
  intersections = raycasterComponent.getIntersection(grabbableObjects);
  
  console.log('  - Пересечений:', intersections ? intersections.length : 0);
  
  if (intersections && intersections.length > 0) {
    const hitObject = intersections[0].object.el;
    console.log('✅ ПОПАДАНИЕ:', hitObject.id);
    debugIntersection.textContent = 'Пересечение: ' + hitObject.id;
    grabObject(hitObject);
  } else {
    console.log('❌ Нет попаданий');
    debugIntersection.textContent = 'Пересечение: нет';
  }
}

// ============================================
// КОМПОНЕНТ ПРЕДМЕТА
// ============================================
AFRAME.registerComponent('grabbable', {
  init: function () {
    const el = this.el;
    
    // Уникальный ID
    el.id = 'item-' + Math.random().toString(36).substr(2, 6);
    
    console.log('📦 Создан grabbable:', el.id);
    console.log('  - Классы:', el.className);
    console.log('  - Есть класс grabbable:', el.classList.contains('grabbable'));
    
    // Клик на объекте
    el.addEventListener('click', function (evt) {
      console.log('🖱️ Клик на объекте:', el.id);
      debugEvent.textContent = 'Событие: Клик на ' + el.id;
      grabObject(el);
    });
    
    // Наведение
    el.addEventListener('mouseenter', () => {
      console.log('👆 Наведение на:', el.id);
      el.setAttribute('material', 'opacity', '0.7');
      el.setAttribute('material', 'transparent', 'true');
    });
    
    el.addEventListener('mouseleave', () => {
      el.setAttribute('material', 'opacity', '1');
      el.setAttribute('material', 'transparent', 'false');
    });
  }
});

// ============================================
// ЗАХВАТ ОБЪЕКТА
// ============================================
function grabObject(el) {
  console.log('🤚 Захват объекта:', el ? el.id : 'NULL');
  
  if (!el) {
    console.error('❌ Объект null!');
    debugGrab.textContent = 'ОШИБКА: null объект';
    return;
  }
  
  const isHeld = el.getAttribute('held');
  console.log('  - Уже в руке:', isHeld);
  
  if (isHeld === 'true') {
    console.log('ℹ️ Уже в руке');
    debugGrab.textContent = 'Уже в руке';
    return;
  }

  console.log('✅ ЗАХВАТ УСПЕШЕН:', el.id);
  debugGrab.textContent = 'ЗАХВАЧЕН: ' + el.id;
  
  el.setAttribute('held', 'true');
  
  // Визуальный эффект
  el.setAttribute('material', 'color', '#FF5722');
  el.setAttribute('material', 'emissive', '#FF5722');
  el.setAttribute('material', 'emissiveIntensity', '0.5');
  el.setAttribute('material', 'opacity', '1');
  el.setAttribute('material', 'transparent', 'false');

  // Останавливаем анимацию
  el.removeAttribute('animation');

  // Перемещаем к камере
  camera.appendChild(el);
  el.setAttribute('position', '0 0 -1.5'); 
  el.setAttribute('rotation', '0 0 0');

  // Счет
  score++;
  scoreEl.innerText = score;
  console.log('📊 Счет:', score);

  // Новый предмет
  setTimeout(spawnItem, 800);
}

// ============================================
// СПАВН ПРЕДМЕТА
// ============================================
function spawnItem() {
  const el = document.createElement('a-box');
  
  const angle = Math.random() * Math.PI * 2;
  const radius = 1 + Math.random() * 3; 
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;

  const colors = ['#4CAF50', '#2196F3', '#FFC107', '#9C27B0', '#E91E63'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];

  el.setAttribute('position', {x: x, y: 0.5, z: z});
  el.setAttribute('rotation', {x: Math.random()*360, y: Math.random()*360, z: Math.random()*360});
  el.setAttribute('material', `color: ${randomColor}; roughness: 0.5; metalness: 0.1`);
  el.setAttribute('class', 'grabbable');
  el.setAttribute('held', 'false');
  el.setAttribute('animation', 'property: rotation; to: 0 360 0; loop: true; dur: 5000; easing: linear');
  el.setAttribute('scale', '0.5 0.5 0.5');

  container.appendChild(el);
  console.log('📦 Создан:', el.id, 'Классы:', el.className);
}

// ============================================
// ОТЛАДОЧНЫЙ ЦИКЛ
// ============================================
function startDebugLoop() {
  console.log('🔍 Запуск отладочного цикла...');
  
  debugInterval = setInterval(() => {
    // Количество объектов
    const grabbableObjects = document.querySelectorAll('.grabbable');
    debugObjects.textContent = 'Объектов в сцене: ' + grabbableObjects.length;
    
    // Курсор
    if (cursor && cursor.components.raycaster) {
      const intersections = cursor.components.raycaster.getIntersection(grabbableObjects);
      if (intersections && intersections.length > 0) {
        debugCursor.textContent = 'Курсор: ' + intersections[0].object.el.id;
      } else {
        debugCursor.textContent = 'Курсор: пусто';
      }
    } else {
      debugCursor.textContent = 'Курсор: нет raycaster';
    }
  }, 500);
}

window.addEventListener('beforeunload', function() {
  if (debugInterval) {
    clearInterval(debugInterval);
  }
});