// Глобальные переменные
let score = 0;
const scoreEl = document.getElementById('score');
const container = document.getElementById('items-container');
const camera = document.getElementById('camera');

// Компонент для предмета
AFRAME.registerComponent('grabbable', {
  init: function () {
    const el = this.el;
    
    // Слушаем событие 'click' от raycaster
    el.addEventListener('click', function (evt) {
      grabObject(el);
    });
  }
});

// Функция захвата предмета
function grabObject(el) {
  // Если предмет уже в руке, игнорируем
  if (el.getAttribute('held')) return;

  el.setAttribute('held', 'true');
  
  // Визуальный эффект
  el.setAttribute('material', 'color', '#FF5722');
  el.setAttribute('material', 'emissive', '#FF5722');
  el.setAttribute('material', 'emissiveIntensity', '0.5');

  // Перемещаем предмет к камере (прикрепляем к ней)
  camera.appendChild(el);
  
  // Позиция перед глазами игрока
  el.setAttribute('position', '0 0 -1.5'); 
  el.setAttribute('rotation', '0 0 0');

  // Обновляем счет
  score++;
  scoreEl.innerText = score;

  // Спавним новый предмет
  setTimeout(spawnItem, 800);
}

// Функция создания предмета
function spawnItem() {
  const el = document.createElement('a-box');
  
  // Случайная позиция вокруг игрока
  const angle = Math.random() * Math.PI * 2;
  const radius = 1 + Math.random() * 3; 
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;

  // Случайный цвет
  const colors = ['#4CAF50', '#2196F3', '#FFC107', '#9C27B0'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];

  el.setAttribute('position', {x: x, y: 0.5, z: z});
  el.setAttribute('rotation', {x: Math.random()*360, y: Math.random()*360, z: Math.random()*360});
  el.setAttribute('material', `color: ${randomColor}; roughness: 0.5; metalness: 0.1`);
  el.setAttribute('class', 'grabbable');
  el.setAttribute('held', 'false');
  
  // Анимация вращения
  el.setAttribute('animation', 'property: rotation; to: 0 360 0; loop: true; dur: 5000; easing: linear');

  container.appendChild(el);
}

// Создаем стартовые предметы (8 штук)
for(let i = 0; i < 8; i++) {
  spawnItem();
}