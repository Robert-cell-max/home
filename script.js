let scene, camera, renderer;
let player, killer, building;
let startTime = 0;         // время старта обратного отсчёта
const countdown = 20;      // 20 секунд ожидания

let gameStarted = false;
let keys = {};
let stamina = 100;
let isRunning = false;
let cameraRotation = 0;

// Для регенерации выносливости
let lastRunReleaseTime = 0;
const regenDelay = 2000;
const regenRate = 0.1;

// Переменная для виртуального джойстика
let joystickVector = new THREE.Vector2(0, 0);
const maxJoystickRadius = 40; // пикселей

// Для поворота камеры пальцем (не используется для мыши)
let rotationPrevClientX = null;

init();
animate();

// Следим за pointer lock, чтобы мышка не выходила за окно
document.addEventListener("pointerlockchange", () => {
  if (gameStarted && document.pointerLockElement !== renderer.domElement) {
    renderer.domElement.requestPointerLock();
  }
}, false);

function init() {
  scene = new THREE.Scene();
  
  // Меняем фон сцены для усиления атмосферы
  scene.background = new THREE.Color(0x20252f);
  
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  // Задаём цвет очистки сцены (фон)
  renderer.setClearColor(0x20252f);
  
  document.body.appendChild(renderer.domElement);
  
  const light = new THREE.AmbientLight(0xffffff, 1);
  scene.add(light);
  
  // Пол (новый декор – добавим текстуру или цвет можно расширять)
  const floorGeo = new THREE.BoxGeometry(40, 0.1, 40);
  const floorMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  scene.add(floor);
  
  // Здание
  const buildingGeo = new THREE.BoxGeometry(14, 12, 14);
  const buildingMat = new THREE.MeshBasicMaterial({ color: 0x555555 });
  building = new THREE.Mesh(buildingGeo, buildingMat);
  building.position.set(0, 4, 0);
  scene.add(building);
  
  const cubeGeo = new THREE.BoxGeometry(1, 1, 1);
  
  // Преследователь (убийца)
  const killerMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  killer = new THREE.Mesh(cubeGeo, killerMat);
  killer.scale.y = 3;
  killer.position.set(-15, 1.5, -15);
  scene.add(killer);
  
  // Игрок
  const playerMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  player = new THREE.Mesh(cubeGeo.clone(), playerMat);
  player.position.set(10, 0.5, 10);
  scene.add(player);
  
  // Добавляем декор – несколько простых декоративных объектов (например, «деревья»)
  addDecor();
  
  // Клавиатурное управление
  window.addEventListener("keydown", e => {
    keys[e.key.toLowerCase()] = true;
  });
  window.addEventListener("keyup", e => {
    if (e.key.toLowerCase() === "f") {
      lastRunReleaseTime = Date.now();
    }
    keys[e.key.toLowerCase()] = false;
  });
  
  // Виртуальный джойстик (для телефона)
  const joystickContainer = document.getElementById("joystick-container");
  const joystick = document.getElementById("joystick");
  
  joystickContainer.addEventListener("touchstart", function(e) {
    e.preventDefault();
    let touch = e.touches[0];
    let rect = joystickContainer.getBoundingClientRect();
    updateJoystick(touch, rect);
  }, { passive: false });
  
  joystickContainer.addEventListener("touchmove", function(e) {
    e.preventDefault();
    let touch = e.touches[0];
    let rect = joystickContainer.getBoundingClientRect();
    updateJoystick(touch, rect);
  }, { passive: false });
  
  joystickContainer.addEventListener("touchend", function(e) {
    e.preventDefault();
    joystick.style.transform = `translate(0px, 0px)`;
    joystickVector.set(0, 0);
  }, { passive: false });
  
  function updateJoystick(touch, rect) {
    let x = touch.clientX - rect.left;
    let y = touch.clientY - rect.top;
    let dx = x - rect.width / 2;
    let dy = y - rect.height / 2;
    let distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > maxJoystickRadius) {
      let angle = Math.atan2(dy, dx);
      dx = Math.cos(angle) * maxJoystickRadius;
      dy = Math.sin(angle) * maxJoystickRadius;
    }
    // Визуальное положение джойстика без изменений
    joystick.style.transform = `translate(${dx}px, ${dy}px)`;
    joystickVector.set(dx, dy);
  }
  
  // Обработка мыши через Pointer Lock API
  renderer.domElement.addEventListener("mousemove", function(e) {
      // Если указатель захвачен, используем e.movementX
      if (document.pointerLockElement === renderer.domElement) {
        cameraRotation -= e.movementX * 0.005;
      }
  });
  
  // Обработчики поворота камеры пальцем – если касание вне зоны джойстика
  renderer.domElement.addEventListener("touchstart", function (e) {
    let joystickRect = document.getElementById("joystick-container").getBoundingClientRect();
    let touch = e.touches[0];
    if (touch.clientX < joystickRect.left || touch.clientX > joystickRect.right ||
        touch.clientY < joystickRect.top || touch.clientY > joystickRect.bottom) {
      rotationPrevClientX = touch.clientX;
    }
  }, { passive: false });
  
  renderer.domElement.addEventListener("touchmove", function (e) {
    let joystickRect = document.getElementById("joystick-container").getBoundingClientRect();
    let touch = e.touches[0];
    if (touch.clientX < joystickRect.left || touch.clientX > joystickRect.right ||
        touch.clientY < joystickRect.top || touch.clientY > joystickRect.bottom) {
      let delta = touch.clientX - rotationPrevClientX;
      cameraRotation -= delta * 0.005;
      rotationPrevClientX = touch.clientX;
    }
  }, { passive: false });
  
  renderer.domElement.addEventListener("touchend", function (e) {
    rotationPrevClientX = null;
  }, { passive: false });
  
  // Обработчики для кнопки бега (на мобильных)
  const runButton = document.getElementById("run-button");
  runButton.addEventListener("touchstart", function (e) {
    e.preventDefault();
    keys["f"] = true;
  }, { passive: false });
  runButton.addEventListener("touchend", function (e) {
    e.preventDefault();
    keys["f"] = false;
    lastRunReleaseTime = Date.now();
  }, { passive: false });
  
  // Стартовая кнопка: при клике включает игру, полный экран и захват указателя
  document.getElementById("start-button").addEventListener("click", function (e) {
    e.preventDefault();
    startGame();
    // Запрашиваем полноэкранный режим
    document.documentElement.requestFullscreen().catch((err) => {
      console.warn("Ошибка перехода в полноэкранный режим: ", err);
    });
    // Запрашиваем захват указателя
    renderer.domElement.requestPointerLock();
  });
}

function addDecor() {
  // Простой декор – набор «деревьев» из конусов
  const decorMaterial = new THREE.MeshPhongMaterial({ color: 0x8B4513 });
  const decorGeo = new THREE.ConeGeometry(0.5, 2, 8);
  
  for (let i = 0; i < 5; i++) {
    let decor = new THREE.Mesh(decorGeo, decorMaterial);
    // Случайные позиции в пределах ограниченной зоны (например, между -10 и 10)
    decor.position.set(-10 + Math.random() * 20, 1, -10 + Math.random() * 20);
    // Немного повернём для разнообразия
    decor.rotation.y = Math.random() * Math.PI * 2;
    scene.add(decor);
  }
}

function movePlayer() {
  let baseSpeed = 0.07;
  let speed = baseSpeed;
  if (keys["f"] && stamina > 0) {
    isRunning = true;
    speed *= 2;
    stamina -= 0.5;
  } else {
    isRunning = false;
    if (Date.now() - lastRunReleaseTime >= regenDelay) {
      stamina += regenRate;
    }
  }
  stamina = Math.max(0, Math.min(100, stamina));
  
  // Определяем вектор взгляда на основе cameraRotation
  const forward = new THREE.Vector3(
    Math.sin(cameraRotation),
    0,
    Math.cos(cameraRotation)
  ).normalize();
  // Правый вектор для страфинга
  const rightVec = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize();
  
  let move = new THREE.Vector3();
  // Управление клавиатурой: W, S, A, D
  if (keys["w"]) move.add(forward.clone().multiplyScalar(speed));
  if (keys["s"]) move.add(forward.clone().multiplyScalar(-speed));
  if (keys["a"]) move.add(rightVec.clone().multiplyScalar(speed));
  if (keys["d"]) move.add(rightVec.clone().multiplyScalar(-speed));
  
  // Обработка ввода с виртуального джойстика
  if (joystickVector.length() > 0) {
    let verticalInput = -joystickVector.y / maxJoystickRadius;
    let horizontalInput = -joystickVector.x / maxJoystickRadius;  // инверсия горизонтальной оси
    move.add(forward.clone().multiplyScalar(verticalInput * speed));
    move.add(rightVec.clone().multiplyScalar(horizontalInput * speed));
  }
  
  const nextPos = player.position.clone().add(move);
  // Новое ограничение зоны движения (уменьшено по сравнению с прошлым значением)
  const zoneLimit = 15; 
  const buildingBox = new THREE.Box3().setFromObject(building);
  const nextBox = new THREE.Box3().setFromCenterAndSize(nextPos, new THREE.Vector3(1, 1, 1));
  // Если позиция игрока всё ещё внутри уменьшенной зоны и не пересекается со зданием, обновляем позицию
  if (Math.abs(nextPos.x) < zoneLimit && Math.abs(nextPos.z) < zoneLimit && !buildingBox.intersectsBox(nextBox)) {
    player.position.copy(nextPos);
  }
  
  // Камера следует за игроком
  camera.position.set(player.position.x, player.position.y + 1.5, player.position.z);
  camera.lookAt(
    player.position.x + forward.x,
    player.position.y + 1.5,
    player.position.z + forward.z
  );
}

function killerMove() {
  if (!gameStarted) return;
  
  const dx = player.position.x - killer.position.x;
  const dz = player.position.z - killer.position.z;
  let dist = Math.sqrt(dx * dx + dz * dz);
  if (dist === 0) dist = 0.0001;
  
  const speed = 0.06;
  const desiredMove = new THREE.Vector3(
    (dx / dist) * speed,
    0,
    (dz / dist) * speed
  );
  const buildingBox = new THREE.Box3().setFromObject(building);
  
  let tentativePosX = killer.position.clone();
  tentativePosX.x += desiredMove.x;
  let killerBox = new THREE.Box3().setFromCenterAndSize(
    tentativePosX,
    new THREE.Vector3(1 * killer.scale.x, 1 * killer.scale.y, 1 * killer.scale.z)
  );
  if (!buildingBox.intersectsBox(killerBox)) {
    killer.position.x = tentativePosX.x;
  }
  
  let tentativePosZ = killer.position.clone();
  tentativePosZ.z += desiredMove.z;
  killerBox = new THREE.Box3().setFromCenterAndSize(
    tentativePosZ,
    new THREE.Vector3(1 * killer.scale.x, 1 * killer.scale.y, 1 * killer.scale.z)
  );
  if (!buildingBox.intersectsBox(killerBox)) {
    killer.position.z = tentativePosZ.z;
  }
  
  const killerFullBox = new THREE.Box3().setFromObject(killer);
  const playerFullBox = new THREE.Box3().setFromObject(player);
  if (killerFullBox.intersectsBox(playerFullBox)) {
    document.getElementById("death-message").innerText = "Ты проиграл";
    document.getElementById("death-message").style.display = "block";
    gameStarted = false;
    document.getElementById("start-button").style.display = "block";
  }
}

function checkBounds() {
  // Теперь зона ограничена по горизонтали/вертикали (уменьшена до 15)
  const zoneLimit = 15;
  if (
    Math.abs(player.position.x) > zoneLimit ||
    Math.abs(player.position.z) > zoneLimit
  ) {
    document.getElementById("death-message").innerText =
      "Ты вышел за пределы зоны. Проиграл.";
    document.getElementById("death-message").style.display = "block";
    gameStarted = false;
    document.getElementById("start-button").style.display = "block";
    return false;
  }
  return true;
}

function animate() {
  requestAnimationFrame(animate);
  const now = Date.now();
  const elapsed = (now - startTime) / 1000;
  
  // Обратный отсчёт до старта игры
  if (elapsed < countdown) {
    document.getElementById("status").innerText =
      `Убийца ждёт: ${Math.ceil(countdown - elapsed)} сек... (Выносливость: ${Math.floor(stamina)})`;
    movePlayer();
  } else {
    if (!gameStarted && document.getElementById("death-message").style.display !== "block") {
      gameStarted = true;
      document.getElementById("status").innerText = "Игра началась! Беги!";
    }
    if (!gameStarted) {
      renderer.render(scene, camera);
      return;
    }
    if (!checkBounds()) {
      renderer.render(scene, camera);
      return;
    }
    movePlayer();
    killerMove();
    if (!gameStarted) {
      renderer.render(scene, camera);
      return;
    }
    document.getElementById("status").innerText = `Выносливость: ${Math.floor(stamina)}`;
  }
  renderer.render(scene, camera);
}

function startGame() {
  gameStarted = false;
  startTime = Date.now();
  stamina = 100;
  // Сбрасываем позицию игрока и убийцы
  player.position.set(10, 0.5, 10);
  killer.position.set(-15, 1.5, -15);
  cameraRotation = 0;
  document.getElementById("death-message").style.display = "none";
  document.getElementById("start-button").style.display = "none";
}
