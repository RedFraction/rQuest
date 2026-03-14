// ============================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ============================================
let score = 0;
let isVR = false;
let isAR = false;
let debugInterval = null;
let scene = null;
let camera = null;
let cursor = null;
let leftController = null;
let rightController = null;
let cursorRayLine = null;
let floorPlane = null;
let highlightedObject = null;
let lastGrabbed = null;

// Элементы UI
const scoreEl = document.getElementById('score');
let container = document.getElementById('items-container');
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
  
  // Создаем линию курсора для визуализации
  if (cursor) {
    cursorRayLine = document.createElement('a-entity');
    cursorRayLine.setAttribute('line', 'start: 0 0 0; end: 0 0 -10; color: cyan; opacity: 0.65');
    cursorRayLine.setAttribute('visible', 'true');
    cursor.appendChild(cursorRayLine);
  }

  floorPlane = document.getElementById('floor-plane');

  setupXRButtons();
  createWristMenu();
  const restored = loadPersistentItems();

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
    const session = scene.renderer.xr?.getSession();
    isAR = !!(session && session.environmentBlendMode === 'alpha-blend');
    isVR = !isAR;

    if (isAR) {
      debugMode.textContent = 'Режим: AR 📱';
      debugMode.style.color = '#00FFFF';
      if (floorPlane) { floorPlane.setAttribute('visible', 'false'); }
      console.log('📱 Вход в AR');
    } else {
      debugMode.textContent = 'Режим: VR 🥽';
      debugMode.style.color = '#00FFFF';
      if (floorPlane) { floorPlane.setAttribute('visible', 'true'); }
      console.log('🥽 Вход в VR');
    }

    const uiLayer = document.getElementById('ui-layer');
    if (uiLayer) { uiLayer.style.display = 'block'; }
    updateWristMenu();
  });
  
  scene.addEventListener('exit-vr', () => {
    isVR = false;
    isAR = false;
    if (floorPlane) { floorPlane.setAttribute('visible', 'true'); }
    const uiLayer = document.getElementById('ui-layer');
    if (uiLayer) { uiLayer.style.display = 'block'; }
    debugMode.textContent = 'Режим: PC 💻';
    debugMode.style.color = '#00FF00';
    console.log('💻 Выход из VR');

    updateWristMenu();
  });
  
  // Настраиваем обработчики
  setupEventListeners();
  
  // Запускаем отладку
  startDebugLoop();
  
  // Создаем предметы
  console.log('📦 [6/7] Создаем предметы...');
  if (!restored) {
    for (let i = 0; i < 8; i++) {
      spawnItem();
    }
  } else {
    console.log('✅ Восстановлено из localStorage, спавн новых не требуется');
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
    } else if (key === 'r') {
      console.log('⌨️ Нажата R (привязка к комнате)');
      debugEvent.textContent = 'Событие: Привязка к комнате';
      if (lastGrabbed) {
        bindObjectToRoom(lastGrabbed);
      }
    } else if (key === 'f') {
      console.log('⌨️ Нажата F (отпуск)');
      debugEvent.textContent = 'Событие: Отпуск';
      if (lastGrabbed) {
        releaseFromRoom(lastGrabbed);
      }
    } else if (key === 'x') {
      console.log('⌨️ Нажата X (создать розовый куб)');
      debugEvent.textContent = 'Событие: Создать розовый куб';
      spawnPinkCube();
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

function setupXRButtons() {
  const btnVR = document.getElementById('btn-vr');
  const btnAR = document.getElementById('btn-ar');
  if (!btnVR || !btnAR || !scene) { return; }

  btnVR.addEventListener('click', () => {
    debugEvent.textContent = 'Событие: Запуск VR';
    if (scene.enterVR) { scene.enterVR(); }
  });

  btnAR.addEventListener('click', async () => {
    debugEvent.textContent = 'Событие: Запуск AR';
    if (scene.enterAR) {
      scene.enterAR();
      return;
    }

    try {
      if (!navigator.xr) { throw new Error('XR не поддерживается'); }
      const supportAR = await navigator.xr.isSessionSupported('immersive-ar');
      if (!supportAR) { throw new Error('AR не поддерживается'); }

      const session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay'],
        domOverlay: { root: document.getElementById('ui-layer') }
      });

      scene.renderer.xr.setReferenceSpaceType('local-floor');
      await scene.renderer.xr.setSession(session);
    } catch (e) {
      console.warn('❌ AR mode failed:', e);
      alert('AR mode не доступен: ' + e.message);
    }
  });
}

function createWristMenu() {
  if (!leftController || !scene) { return; }

  const menu = document.createElement('a-entity');
  menu.setAttribute('id', 'left-wrist-menu');
  menu.setAttribute('position', '0.08 0.04 -0.06');
  menu.setAttribute('rotation', '-90 0 0');
  menu.setAttribute('scale', '0.6 0.6 0.6');

  const bg = document.createElement('a-plane');
  bg.setAttribute('width', '0.25');
  bg.setAttribute('height', '0.32');
  bg.setAttribute('color', '#000');
  bg.setAttribute('opacity', '0.6');
  menu.appendChild(bg);

  const info = document.createElement('a-text');
  info.setAttribute('id', 'wrist-menu-text');
  info.setAttribute('value', 'MENU\nR: Anchor\nF: Release\nQ/E: Grab');
  info.setAttribute('align', 'left');
  info.setAttribute('color', '#FFF');
  info.setAttribute('position', '-0.11 0.1 0.01');
  info.setAttribute('width', '0.45');
  menu.appendChild(info);

  leftController.appendChild(menu);
}

function updateWristMenu() {
  const info = document.getElementById('wrist-menu-text');
  if (!info) { return; }

  const mode = isAR ? 'AR' : isVR ? 'VR' : 'PC';
  info.setAttribute('value', `MENU\nРежим: ${mode}\nОчки: ${score}\nR: Anchor\nF: Release\nQ/E: Grab`);
}

function bindObjectToRoom(el) {
  if (!el || !scene) { return; }
  try {
    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    el.object3D.getWorldPosition(worldPos);
    el.object3D.getWorldQuaternion(worldQuat);
    el.object3D.getWorldScale(worldScale);

    scene.appendChild(el);
    el.object3D.position.copy(worldPos);
    el.object3D.quaternion.copy(worldQuat);
    el.object3D.scale.copy(worldScale);

    el.setAttribute('room-anchored', 'true');
    el.setAttribute('held', 'false');
    debugEvent.textContent = `Событие: ${el.id} привязан к комнате`;
    console.log('📍 Привязано к комнате:', el.id);

    savePersistentItems();
    updateWristMenu();
  } catch (e) {
    console.warn('Ошибка привязки к комнате', e);
  }
}

function releaseFromRoom(el) {
  if (!el) { return; }
  el.removeAttribute('room-anchored');
  el.setAttribute('held', 'false');
  debugEvent.textContent = `Событие: ${el.id} отвязан от комнаты`;
  console.log('🆓 Отвязан от комнаты:', el.id);

  savePersistentItems();
  updateWristMenu();
}

// ============================================
// ПРОВЕРКА ПЕРЕСЕЧЕНИЙ
// ============================================
function checkIntersectionAndGrab(source) {
  console.log('🔍 Проверка пересечений...', source ? source.id : 'курсор');
  
  let intersections = [];
  
  // Получаем raycaster из источника
  let raycasterComponent = null;
  
  if (source && source.components && source.components.raycaster) {
    raycasterComponent = source.components.raycaster;
  } else if (cursor && cursor.components && cursor.components.raycaster) {
    raycasterComponent = cursor.components.raycaster;
  }
  
  if (!raycasterComponent) {
    console.error('❌ Raycaster не найден!');
    debugIntersection.textContent = 'Raycaster: НЕ НАЙДЕН';
    return;
  }
  
  // Получаем все объекты с классом grabbable
  const grabbableObjects = document.querySelectorAll('.grabbable');
  console.log('  - Найдено объектов .grabbable:', grabbableObjects.length);
  
  // Проверяем каждый объект для отладки
  grabbableObjects.forEach((obj, index) => {
    console.log('  - Объект ' + index + ':', obj.id, 'Классы:', obj.className);
  });

  // A-Frame хранит пересечения в компоненте raycaster.intersections
  if (raycasterComponent.intersections && raycasterComponent.intersections.length > 0) {
    intersections = raycasterComponent.intersections;
  } else if (typeof raycasterComponent.getIntersection === 'function') {
    // Фолбек для старых версий
    const first = raycasterComponent.getIntersection(grabbableObjects);
    if (first) {
      intersections = [first];
    }
  }

  console.log('  - Пересечений:', intersections ? intersections.length : 0);

  if (intersections && intersections.length > 0) {
    const hit = intersections.find(i => i.object && i.object.el && i.object.el.classList.contains('grabbable'));
    if (hit && hit.object.el) {
      const hitObject = hit.object.el;
      console.log('✅ ПОПАДАНИЕ:', hitObject.id);
      debugIntersection.textContent = 'Пересечение: ' + hitObject.id;
      highlightedObject = hitObject;
      lastGrabbed = hitObject;
      highlightObject(hitObject);
      grabObject(hitObject);
      return;
    }
  }

  console.log('❌ Нет попаданий');
  debugIntersection.textContent = 'Пересечение: нет';
  unhighlightObject();
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
// ПОДСВЕТКА ОБЪЕКТА
// ============================================
function highlightObject(el) {
  if (!el || highlightedObject === el || el.getAttribute('held') === 'true') { return; }

  unhighlightObject();

  highlightedObject = el;
  el.setAttribute('material', 'color', '#FFEB3B');
  el.setAttribute('material', 'emissive', '#FFEB3B');
  el.setAttribute('material', 'emissiveIntensity', '0.3');
}

function unhighlightObject() {
  if (!highlightedObject) { return; }
  const obj = highlightedObject;
  highlightedObject = null;

  if (obj.getAttribute('held') !== 'true') {
    const defaultColor = obj.getAttribute('material') && obj.getAttribute('material').color ? obj.getAttribute('material').color : '#FFF';
    obj.setAttribute('material', 'color', defaultColor);
    obj.setAttribute('material', 'emissive', '#000');
    obj.setAttribute('material', 'emissiveIntensity', '0');
  }
}

function playGrabSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.25);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.25);
  } catch (e) {
    console.warn('🔊 Не удалось воспроизвести звук: ', e);
  }
}

function spawnGrabParticles(el) {
  if (!scene || !el || !el.object3D) { return; }

  const area = new THREE.Vector3();
  el.object3D.getWorldPosition(area);

  const emitter = document.createElement('a-entity');
  emitter.setAttribute('position', `${area.x} ${area.y} ${area.z}`);

  const count = 10;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('a-sphere');
    const size = 0.03 + Math.random() * 0.03;
    const dx = (Math.random() - 0.5) * 0.8;
    const dy = (Math.random() - 0.2) * 0.8;
    const dz = (Math.random() - 0.5) * 0.8;

    p.setAttribute('radius', size);
    p.setAttribute('material', `color: #ffd600; emissive: #ffeb3b; emissiveIntensity: 1`);
    p.setAttribute('position', '0 0 0');
    p.setAttribute('animation__move', `property: position; to: ${dx} ${dy} ${dz}; dur: 450; easing: easeOutQuad;`);
    p.setAttribute('animation__fade', 'property: material.opacity; to: 0; dur: 450; easing: linear;');
    p.setAttribute('material', 'opacity', '1');

    emitter.appendChild(p);
  }

  scene.appendChild(emitter);

  setTimeout(() => {
    if (emitter.parentNode) {
      emitter.parentNode.removeChild(emitter);
    }
  }, 500);
}

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

  lastGrabbed = el;
  updateWristMenu();
  
  const isHeld = el.getAttribute('held');
  console.log('  - Уже в руке:', isHeld);
  
  if (isHeld === 'true') {
    console.log('ℹ️ Уже в руке');
    debugGrab.textContent = 'Уже в руке';
    return;
  }

  const propType = el.getAttribute('data-prop-type') || 'unknown';
  console.log('✅ ЗАХВАТ УСПЕШЕН:', el.id, 'Тип:', propType);
  debugGrab.textContent = `ЗАХВАЧЕН: ${el.id} (${propType})`;

  playGrabSound();
  spawnGrabParticles(el);

  el.setAttribute('held', 'true');

  // Визуальный эффект
  el.setAttribute('material', 'color', '#FF5722');
  el.setAttribute('material', 'emissive', '#FF5722');
  el.setAttribute('material', 'emissiveIntensity', '0.8');
  el.setAttribute('material', 'opacity', '1');
  el.setAttribute('material', 'transparent', 'false');

  // Останавливаем анимацию
  el.removeAttribute('animation');

  // Перемещаем к камере
  camera.appendChild(el);
  el.setAttribute('position', '0 0 -1.5'); 
  el.setAttribute('rotation', '0 0 0');

  // Пропускаем визуалку, чтобы снять подсветку
  unhighlightObject();

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
  const itemTypes = ['a-box', 'a-sphere', 'a-cylinder', 'a-cone'];
  const itemProps = [
    { name: 'crate', color: '#8D6E63', scale: '0.6 0.6 0.6', radius: null },
    { name: 'orb', color: '#03A9F4', scale: '0.45 0.45 0.45', radius: null },
    { name: 'barrel', color: '#FF9800', scale: '0.5 0.7 0.5', radius: 0.25 },
    { name: 'cone', color: '#E91E63', scale: '0.5 0.7 0.5', radius: 0.28 },
    { name: 'gem', color: '#9C27B0', scale: '0.4 0.4 0.4', radius: null }
  ];

  const typeIndex = Math.floor(Math.random() * itemTypes.length);
  const itemType = itemTypes[typeIndex];
  const itemProp = itemProps[Math.floor(Math.random() * itemProps.length)];

  const el = document.createElement(itemType);
  el.setAttribute('id', 'item-' + Math.random().toString(36).substr(2, 6));

  const angle = Math.random() * Math.PI * 2;
  const radius = 1 + Math.random() * 3;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;

  el.setAttribute('position', {x: x, y: 0.55, z: z});
  el.setAttribute('rotation', {x: Math.random()*360, y: Math.random()*360, z: Math.random()*360});
  el.setAttribute('material', `color: ${itemProp.color}; roughness: 0.35; metalness: 0.15`);
  el.setAttribute('class', 'grabbable');
  el.setAttribute('grabbable', '');
  el.setAttribute('held', 'false');
  el.setAttribute('animation', 'property: rotation; to: 0 360 0; loop: true; dur: 5000; easing: linear');
  el.setAttribute('scale', itemProp.scale);

  if (itemProp.radius !== null && el.setAttribute) {
    el.setAttribute('radius', itemProp.radius);
  }

  // Сохранить тип предмета для отладки
  el.setAttribute('data-prop-type', itemProp.name);

  container.appendChild(el);
  console.log('📦 Создан:', el.id, 'Тип:', itemProp.name, 'Форма:', itemType, 'Классы:', el.className);
  savePersistentItems();
}

function spawnPinkCube() {
  if (!camera || !scene) { return; }

  const camWorldPos = new THREE.Vector3();
  const camWorldDir = new THREE.Vector3();
  camera.object3D.getWorldPosition(camWorldPos);
  camera.object3D.getWorldDirection(camWorldDir);

  const spawnPos = camWorldPos.clone().add(camWorldDir.multiplyScalar(1.2));

  const el = document.createElement('a-box');
  el.setAttribute('id', 'item-' + Math.random().toString(36).substr(2, 6));
  el.setAttribute('position', { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z });
  el.setAttribute('rotation', { x: 0, y: 0, z: 0 });
  el.setAttribute('scale', '0.4 0.4 0.4');
  el.setAttribute('material', 'color: #FF69B4; roughness: 0.3; metalness: 0.15');
  el.setAttribute('class', 'grabbable');
  el.setAttribute('grabbable', '');
  el.setAttribute('held', 'false');
  el.setAttribute('data-prop-type', 'pink-cube');
  el.setAttribute('animation', 'property: rotation; to: 0 360 0; loop: true; dur: 4000; easing: linear');

  container.appendChild(el);
  console.log('📦 Создан розовый куб:', el.id);

  savePersistentItems();
}

function savePersistentItems() {
  try {
    const grabbableObjects = document.querySelectorAll('.grabbable');
    const data = Array.from(grabbableObjects).map((obj) => ({
      id: obj.id,
      tag: obj.tagName.toLowerCase(),
      position: obj.getAttribute('position'),
      rotation: obj.getAttribute('rotation'),
      scale: obj.getAttribute('scale'),
      color: obj.getAttribute('material') ? obj.getAttribute('material').color : '#FFFFFF',
      propType: obj.getAttribute('data-prop-type') || 'default',
      roomAnchored: obj.hasAttribute('room-anchored'),
      held: obj.getAttribute('held') === 'true'
    }));
    localStorage.setItem('webxrquest-persistent-items', JSON.stringify(data));
    console.log('💾 Сохранено', data.length, 'объектов');
  } catch (e) {
    console.warn('💾 Не удалось сохранить объектные данные', e);
  }
}

function loadPersistentItems() {
  try {
    const raw = localStorage.getItem('webxrquest-persistent-items');
    if (!raw) { return; }

    const data = JSON.parse(raw);
    if (!Array.isArray(data)) { return; }

    data.forEach((item) => {
      if (!item.tag) { return; }
      const el = document.createElement(item.tag);
      el.setAttribute('id', item.id || 'item-' + Math.random().toString(36).substr(2, 6));
      el.setAttribute('position', item.position || '0 0.5 -2');
      el.setAttribute('rotation', item.rotation || '0 0 0');
      el.setAttribute('scale', item.scale || '0.5 0.5 0.5');
      el.setAttribute('material', `color: ${item.color || '#FF69B4'}; roughness: 0.35; metalness: 0.15`);
      el.setAttribute('class', 'grabbable');
      el.setAttribute('grabbable', '');
      el.setAttribute('held', item.held ? 'true' : 'false');
      el.setAttribute('data-prop-type', item.propType || 'persisted');
      if (item.roomAnchored) {
        el.setAttribute('room-anchored', 'true');
      }
      el.setAttribute('animation', 'property: rotation; to: 0 360 0; loop: true; dur: 5000; easing: linear');
      container.appendChild(el);
    });

    console.log('💾 Загрузено', data.length, 'сохраненных объектов');
    return data.length;
  } catch (e) {
    console.warn('💾 Не удалось загрузить сохраненные объекты', e);
    return 0;
  }
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
      let intersections = [];
      const raycaster = cursor.components.raycaster;

      if (raycaster.intersections && raycaster.intersections.length > 0) {
        intersections = raycaster.intersections;
      } else if (typeof raycaster.getIntersection === 'function') {
        const first = raycaster.getIntersection(grabbableObjects);
        if (first) { intersections = [first]; }
      }

      if (intersections && intersections.length > 0) {
        const target = intersections[0].object.el;
        debugCursor.textContent = 'Курсор: ' + target.id;
        highlightObject(target);

        if (cursorRayLine && intersections[0].point) {
          const p = intersections[0].point;
          cursorRayLine.setAttribute('line', `start: 0 0 0; end: ${p.x} ${p.y} ${p.z}; color: cyan; opacity: 0.8`);
          cursorRayLine.setAttribute('visible', 'true');
        }
      } else {
        debugCursor.textContent = 'Курсор: пусто';
        unhighlightObject();
        if (cursorRayLine) {
          cursorRayLine.setAttribute('line', 'start: 0 0 0; end: 0 0 -10; color: cyan; opacity: 0.25');
          cursorRayLine.setAttribute('visible', 'true');
        }
      }
    } else {
      debugCursor.textContent = 'Курсор: нет raycaster';
      unhighlightObject();
    }
  }, 100);
}

window.addEventListener('beforeunload', function() {
  if (debugInterval) {
    clearInterval(debugInterval);
  }
});