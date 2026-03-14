// ============================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ============================================
let score = 0;
let isVR = false;
let debugInterval = null;

// Элементы UI
const scoreEl = document.getElementById('score');
const container = document.getElementById('items-container');
const camera = document.getElementById('camera');
const cursor = document.getElementById('cursor');

// Отладочные элементы
const debugMode = document.getElementById('debug-mode');
const debugRayLeft = document.getElementById('debug-ray-left');
const debugRayRight = document.getElementById('debug-ray-right');
const debugCursor = document.getElementById('debug-cursor');
const debugHit = document.getElementById('debug-hit');
const debugEvent = document.getElementById('debug-event');
const debugGrab = document.getElementById('debug-grab');

// Контроллеры
let leftController = null;
let rightController = null;
let scene = null;

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================
document.addEventListener('DOMContentLoaded', function() {
  console.log('🔍 [INIT] DOM загружен, ждём сцену...');
  
  scene = document.querySelector('a-scene');
  
  if (scene.hasLoaded) {
    initGame();
  } else {
    scene.addEventListener('loaded', function() {
      console.log('✅ [INIT] Сцена загружена');
      initGame();
    });
  }
});

function initGame() {
  console.log('🎮 [INIT] Инициализация игры...');
  
  leftController = document.getElementById('left-controller');
  rightController = document.getElementById('right-controller');
  
  // Проверка элементов
  console.log('📦 [INIT] Курсор:', cursor ? 'OK' : 'NOT FOUND');
  console.log('📦 [INIT] Левый контроллер:', leftController ? 'OK' : 'NOT FOUND');
  console.log('📦 [INIT] Правый контроллер:', rightController ? 'OK' : 'NOT FOUND');
  console.log('📦 [INIT] Камера:', camera ? 'OK' : 'NOT FOUND');
  
  // Слушаем вход/выход из VR
  scene.addEventListener('enter-vr', () => {
    isVR = true;
    debugMode.textContent = 'Режим: VR/AR 🥽';
    debugMode.style.color = '#00FFFF';
    console.log('🥽 [VR] Вход в VR/AR режим');
  });
  
  scene.addEventListener('exit-vr', () => {
    isVR = false;
    debugMode.textContent = 'Режим: PC 💻';
    debugMode.style.color = '#00FF00';
    console.log('💻 [VR] Выход из VR/AR режима');
  });
  
  // Настраиваем обработчики событий
  setupEventListeners();
  
  // Запускаем отладочный цикл
  startDebugLoop();
  
  // Создаем стартовые предметы
  console.log('📦 [SPAWN] Создаем 8 стартовых предметов...');
  for(let i = 0; i < 8; i++) {
    spawnItem();
  }
  
  console.log('✅ [INIT] Игра готова!');
}

// ============================================
// ОБРАБОТЧИКИ СОБЫТИЙ
// ============================================
function setupEventListeners() {
  console.log('🔌 [EVENTS] Настройка обработчиков событий...');
  
  // 1. Клик мышью (ПК) - самый надёжный способ
  document.addEventListener('click', function(evt) {
    console.log('🖱️ [EVENT] Глобальный клик detected');
    
    // Проверяем, кликнули ли по canvas A-Frame
    if (evt.target.tagName === 'CANVAS' || evt.target.closest('#scene')) {
      checkClickOnGrabbable();
    }
  });
  
  // 2. Клавиши Q и E (ПК тесты)
  document.addEventListener('keydown', function(event) {
    const key = event.key.toLowerCase();
    
    if (key === 'q') {
      console.log('⌨️ [EVENT] Нажата клавиша Q (левый курок)');
      debugEvent.textContent = 'Событие: Q (левый)';
      if (leftController) {
        simulateTrigger(leftController, 'Левый');
      }
    } else if (key === 'e') {
      console.log('⌨️ [EVENT] Нажата клавиша E (правый курок)');
      debugEvent.textContent = 'Событие: E (правый)';
      if (rightController) {
        simulateTrigger(rightController, 'Правый');
      }
    }
  });
  
  // 3. События от контроллеров VR
  if (leftController) {
    leftController.addEventListener('triggerdown', function(evt) {
      console.log('🎮 [VR] Левый курок нажат');
      debugEvent.textContent = 'Событие: Левый курок';
      simulateTrigger(leftController, 'Левый VR');
    });
    
    leftController.addEventListener('mouseenter', function(evt) {
      if (evt.detail && evt.detail.el) {
        console.log('👆 [VR] Левый луч наведён на:', evt.detail.el.id);
      }
    });
  }
  
  if (rightController) {
    rightController.addEventListener('triggerdown', function(evt) {
      console.log('🎮 [VR] Правый курок нажат');
      debugEvent.textContent = 'Событие: Правый курок';
      simulateTrigger(rightController, 'Правый VR');
    });
    
    rightController.addEventListener('mouseenter', function(evt) {
      if (evt.detail && evt.detail.el) {
        console.log('👆 [VR] Правый луч наведён на:', evt.detail.el.id);
      }
    });
  }
  
  // 4. События от курсора (ПК)
  if (cursor) {
    cursor.addEventListener('mouseenter', function(evt) {
      if (evt.detail && evt.detail.el) {
        console.log('👆 [PC] Курсор наведён на:', evt.detail.el.id);
        debugHit.textContent = 'Попадание: ' + evt.detail.el.id;
      }
    });
    
    cursor.addEventListener('mouseleave', function(evt) {
      debugHit.textContent = 'Попадание: -';
    });
    
    cursor.addEventListener('click', function(evt) {
      console.log('🖱️ [PC] Клик курсора');
      debugEvent.textContent = 'Событие: Клик курсора';
      if (evt.detail && evt.detail.el) {
        grabObject(evt.detail.el, 'Курсор ПК');
      }
    });
  }
}

// ============================================
// ПРОВЕРКА КЛИКА ПО ОБЪЕКТАМ
// ============================================
function checkClickOnGrabbable() {
  console.log('🔍 [CLICK] Проверка попаданий...');
  
  // Проверяем курсор (ПК)
  if (cursor && cursor.components.raycaster) {
    const intersections = cursor.components.raycaster.getIntersection(
      document.querySelectorAll('.grabbable')
    );
    
    console.log('🔍 [CLICK] Пересечений курсором:', intersections ? intersections.length : 0);
    
    if (intersections && intersections.length > 0) {
      const hitObject = intersections[0].object.el;
      console.log('✅ [CLICK] Попадание курсором:', hitObject.id);
      debugHit.textContent = 'Попадание: ' + hitObject.id;
      grabObject(hitObject, 'Курсор ПК');
      return;
    }
  }
  
  // Проверяем левый контроллер
  if (leftController && leftController.components.raycaster) {
    const intersections = leftController.components.raycaster.getIntersection(
      document.querySelectorAll('.grabbable')
    );
    
    if (intersections && intersections.length > 0) {
      const hitObject = intersections[0].object.el;
      console.log('✅ [CLICK] Попадание левым контроллером:', hitObject.id);
      debugHit.textContent = 'Попадание: ' + hitObject.id + ' (L)';
      grabObject(hitObject, 'Левый контроллер');
      return;
    }
  }
  
  // Проверяем правый контроллер
  if (rightController && rightController.components.raycaster) {
    const intersections = rightController.components.raycaster.getIntersection(
      document.querySelectorAll('.grabbable')
    );
    
    if (intersections && intersections.length > 0) {
      const hitObject = intersections[0].object.el;
      console.log('✅ [CLICK] Попадание правым контроллером:', hitObject.id);
      debugHit.textContent = 'Попадание: ' + hitObject.id + ' (R)';
      grabObject(hitObject, 'Правый контроллер');
      return;
    }
  }
  
  console.log('❌ [CLICK] Нет попаданий');
  debugHit.textContent = 'Попадание: Нет';
}

// ============================================
// СИМУЛЯЦИЯ КУРКА
// ============================================
function simulateTrigger(controller, source) {
  console.log('🔫 [TRIGGER] Симуляция курка:', source);
  
  if (!controller || !controller.components.raycaster) {
    console.warn('⚠️ [TRIGGER] Контроллер или raycaster не найден');
    return;
  }
  
  const raycaster = controller.components.raycaster;
  const intersections = raycaster.getIntersection(
    document.querySelectorAll('.grabbable')
  );
  
  console.log('🔍 [TRIGGER] Пересечений:', intersections ? intersections.length : 0);
  
  if (intersections && intersections.length > 0) {
    const hitObject = intersections[0].object.el;
    console.log('✅ [TRIGGER] Попадание:', hitObject.id);
    debugHit.textContent = 'Попадание: ' + hitObject.id;
    
    // Визуальная обратная связь
    if (cursor) {
      cursor.setAttribute('material', 'color', '#FF5722');
      setTimeout(() => {
        cursor.setAttribute('material', 'color', 'cyan');
      }, 150);
    }
    
    grabObject(hitObject, source);
  } else {
    console.log('❌ [TRIGGER] Нет попаданий');
    debugHit.textContent = 'Попадание: Нет (' + source + ')';
  }
}

// ============================================
// КОМПОНЕНТ ПРЕДМЕТА
// ============================================
AFRAME.registerComponent('grabbable', {
  init: function () {
    const el = this.el;
    
    // Генерируем уникальный ID
    el.id = 'item-' + Math.random().toString(36).substr(2, 6);
    el.setAttribute('data-grabbable', 'true');
    
    console.log('📦 [GRABBABLE] Создан предмет:', el.id);
    
    // Событие клика на объекте
    el.addEventListener('click', function (evt) {
      console.log('🖱️ [GRABBABLE] Клик на объекте:', el.id);
      debugEvent.textContent = 'Событие: Клик на ' + el.id;
      grabObject(el, 'Клик на объекте');
    });
    
    // Наведение
    el.addEventListener('mouseenter', () => {
      el.setAttribute('material', 'opacity', '0.7');
      el.setAttribute('material', 'transparent', 'true');
    });
    
    el.addEventListener('mouseleave', () => {
      el.setAttribute('material', 'opacity', '1');
    });
  }
});

// ============================================
// ЗАХВАТ ОБЪЕКТА
// ============================================
function grabObject(el, source) {
  console.log('🤚 [GRAB] Попытка захвата от:', source);
  
  if (!el) {
    console.error('❌ [GRAB] Объект null!');
    debugGrab.textContent = 'Статус: ОШИБКА (null)';
    return;
  }
  
  if (!el.parentNode) {
    console.error('❌ [GRAB] Объект не в DOM!', el.id);
    debugGrab.textContent = 'Статус: ОШИБКА (нет в DOM)';
    return;
  }
  
  const isHeld = el.getAttribute('held');
  console.log('🔍 [GRAB] Объект:', el.id, 'Уже в руке:', isHeld);
  
  if (isHeld === 'true') {
    console.log('ℹ️ [GRAB] Объект уже в руке');
    debugGrab.textContent = 'Статус: Уже в руке';
    return;
  }

  console.log('✅ [GRAB] ЗАХВАТ УСПЕШЕН:', el.id);
  debugGrab.textContent = 'Статус: ЗАХВАЧЕН (' + el.id + ')';
  
  el.setAttribute('held', 'true');
  
  // Визуальный эффект
  el.setAttribute('material', 'color', '#FF5722');
  el.setAttribute('material', 'emissive', '#FF5722');
  el.setAttribute('material', 'emissiveIntensity', '0.5');
  el.setAttribute('material', 'opacity', '1');
  el.setAttribute('material', 'transparent', 'false');

  // Останавливаем анимацию вращения
  el.removeAttribute('animation');

  // Перемещаем к камере
  camera.appendChild(el);
  el.setAttribute('position', '0 0 -1.5'); 
  el.setAttribute('rotation', '0 0 0');

  // Счет
  score++;
  scoreEl.innerText = score;
  console.log('📊 [SCORE] Новый счет:', score);

  // Новый предмет
  console.log('📦 [SPAWN] Спавн нового предмета через 800мс...');
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
  console.log('📦 [SPAWN] Создан предмет:', el.id, 'Позиция:', x.toFixed(2), z.toFixed(2));
}

// ============================================
// ОТЛАДОЧНЫЙ ЦИКЛ
// ============================================
function startDebugLoop() {
  console.log('🔍 [DEBUG] Запуск отладочного цикла...');
  
  debugInterval = setInterval(() => {
    // Курсор
    if (cursor && cursor.components.raycaster) {
      const intersections = cursor.components.raycaster.getIntersection(
        document.querySelectorAll('.grabbable')
      );
      if (intersections && intersections.length > 0) {
        debugCursor.textContent = 'Курсор: ' + intersections[0].object.el.id;
      } else {
        debugCursor.textContent = 'Курсор: пусто';
      }
    }
    
    // Левый контроллер
    if (leftController && leftController.components.raycaster) {
      const intersections = leftController.components.raycaster.getIntersection(
        document.querySelectorAll('.grabbable')
      );
      if (intersections && intersections.length > 0) {
        debugRayLeft.textContent = 'Левый луч: ' + intersections[0].object.el.id;
      } else {
        debugRayLeft.textContent = 'Левый луч: пусто';
      }
    }
    
    // Правый контроллер
    if (rightController && rightController.components.raycaster) {
      const intersections = rightController.components.raycaster.getIntersection(
        document.querySelectorAll('.grabbable')
      );
      if (intersections && intersections.length > 0) {
        debugRayRight.textContent = 'Правый луч: ' + intersections[0].object.el.id;
      } else {
        debugRayRight.textContent = 'Правый луч: пусто';
      }
    }
  }, 300);
}

// Очистка при закрытии
window.addEventListener('beforeunload', function() {
  if (debugInterval) {
    clearInterval(debugInterval);
  }
});