// index.js — реализация тестового задания (ES5)
// Требования: jQuery должен быть доступен (как в index.html).

(function () {
    // размеры карты
    let MAP_W = 40;
    let MAP_H = 24;
    let TILE_SIZE = 50;
  
    // символы карт
    let WALL = 'W';
    let FLOOR = '.';
  
    // игровое состояние
    let map = []; // 2D array of chars: 'W' or '.'
    let items = {}; // key "x_y" -> {type: 'sword'|'potion'}
    let hero = null; // {x,y,hp,maxHp,atk}
    let enemies = []; // {id,x,y,hp,atk}
    let nextEnemyId = 1;
    let score = 0;
    let elapsed = 0;
    let gameStartTime = null;
    let hudTimer = null;
    let portal = null;
  
    // config
    let ROOM_MIN = 3;
    let ROOM_MAX = 8;
    let ROOM_COUNT_MIN = 5;
    let ROOM_COUNT_MAX = 10;
    let V_CORRIDORS_MIN = 3;
    let V_CORRIDORS_MAX = 5;
    let H_CORRIDORS_MIN = 3;
    let H_CORRIDORS_MAX = 5;
    let SWORD_COUNT = 2;
    let POTION_COUNT = 10;
    let ENEMY_COUNT = 10;
    
    // Портал
    function spawnPortal() {
      placeOnEmpty((x, y) => {
          console.log("Portal spawned")
          portal = { x, y };
      });
    }

    // Края поля
    function adjustFieldBox() {
      let w = MAP_W * TILE_SIZE;
      let h = MAP_H * TILE_SIZE;
      $('.field-box').css({ width: w + 3 + 'px', height: h + 3  + 'px' });
    }
    // Обновление худа
    function updateHUD() {
      elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
      $('#hud-hp').text('❤️ HP: ' + hero.hp + '/' + hero.maxHp);
      $('#hud-atk').text('⚔️ Атака: ' + hero.atk);
      $('#hud-score').text('☠️ Счёт: ' + score);
      $('#hud-time').text('⏱️ Время: ' + elapsed + ' c');
    }
    function randInt(a, b) {
      return Math.floor(Math.random() * (b - a + 1)) + a;
    }
    function key(x, y) { return x + '_' + y; }
    // Столкновение
    function inBounds(x, y) { return x >= 0 && x < MAP_W && y >= 0 && y < MAP_H; }
    // Возможность передвижения
    function isWalkable(x, y) {
      if (!inBounds(x, y)) return false;
      if (map[y][x] === WALL) return false;
      // check if enemy occupies
      for (let i = 0; i < enemies.length; i++) {
        if (enemies[i].x === x && enemies[i].y === y) return false;
      }
      // Герой может двигаться во вражеский тайл? Мы будем блокировать перемещение во вражеский тайл
      if (hero && hero.x === x && hero.y === y) return false;
      return true;
    }
    // ПОиск пустых клеток
    function placeOnEmpty(cb) {
      // нахождение случайной ячейки на полу без предметов/врагов/героя
      let tries = 0;
      while (tries < 10000) {
        let x = randInt(0, MAP_W - 1);
        let y = randInt(0, MAP_H - 1);
        if (!isWalkable(x,y)) { tries++; continue; }
        if (items[key(x,y)]) { tries++; continue; }
        let occ = false;
        if (hero && hero.x === x && hero.y === y) occ = true;
        for (let i = 0; i < enemies.length; i++) {
          if (enemies[i].x === x && enemies[i].y === y) { occ = true; break; }
        }
        if (occ) { tries++; continue; }
        return cb(x,y);
      }
      // запасное линейное сканирование
      for (let yy = 0; yy < MAP_H; yy++) {
        for (let xx = 0; xx < MAP_W; xx++) {
          if (map[yy][xx] !== FLOOR) continue;
          if (items[key(xx,yy)]) continue;
          let occ2 = false;
          if (hero && hero.x === xx && hero.y === yy) occ2 = true;
          for (let j = 0; j < enemies.length; j++) {
            if (enemies[j].x === xx && enemies[j].y === yy) { occ2 = true; break; }
          }
          if (!occ2) return cb(xx, yy);
        }
      }
      return null;
    }
    // Генерация карты
    function genMap() {
      // Заполнение стен
      map = Array.from({length: MAP_H}, () => Array(MAP_W).fill(WALL));
  
      // Генерация комнаты
      let roomCount = randInt(ROOM_COUNT_MIN, ROOM_COUNT_MAX);
      let rooms = [];
      for (let r = 0; r < roomCount; r++) {
          let w = randInt(ROOM_MIN, ROOM_MAX);
          let h = randInt(ROOM_MIN, ROOM_MAX);
          let x = randInt(1, MAP_W - w - 2);
          let y = randInt(1, MAP_H - h - 2);
          for (let yy = y; yy < y+h; yy++)
              for (let xx = x; xx < x+w; xx++)
                  map[yy][xx] = FLOOR;
          rooms.push({x:x, y:y, w:w, h:h, cx:x+Math.floor(w/2), cy:y+Math.floor(h/2)});
      }
  
      // Соединение комнат, чтобы гарантировать доступность
      let connected = [rooms[0]];
      for (let i = 1; i < rooms.length; i++) {
          let room = rooms[i];
          // Нахождение ближайшей подключенной комнаты
          let nearest = connected.reduce((best, r) => {
              let d1 = Math.abs(r.cx - room.cx) + Math.abs(r.cy - room.cy);
              let d2 = Math.abs(best.cx - room.cx) + Math.abs(best.cy - room.cy);
              return d1 < d2 ? r : best;
          }, connected[0]);
  
          // L-образный коридор
          let x1 = nearest.cx, y1 = nearest.cy, x2 = room.cx, y2 = room.cy;
          for (let x = Math.min(x1,x2); x <= Math.max(x1,x2); x++) map[y1][x] = FLOOR;
          for (let y = Math.min(y1,y2); y <= Math.max(y1,y2); y++) map[y][x2] = FLOOR;
  
          connected.push(room);
      }
  
      // Дополнительно: несколько случайных коридоров для разнообразия
      for (let i = 0; i < randInt(V_CORRIDORS_MIN,V_CORRIDORS_MAX); i++) {
          let cx = randInt(0, MAP_W-1);
          for (let yy = 0; yy < MAP_H; yy++) map[yy][cx] = FLOOR;
      }
      for (let i = 0; i < randInt(H_CORRIDORS_MIN,H_CORRIDORS_MAX); i++) {
          let cy = randInt(0, MAP_H-1);
          for (let xx = 0; xx < MAP_W; xx++) map[cy][xx] = FLOOR;
      }
  
      // Сброс предметов/противников
      items = {};
      enemies = [];
      nextEnemyId = 1;
    }
    // заполнить элементы и актеров
    function populate() {
      // Мечи
      for (let s = 0; s < SWORD_COUNT; s++) {
        placeOnEmpty(function (x,y) { items[key(x,y)] = { type: 'sword' }; });
      }
      // Зелья
      for (let p = 0; p < POTION_COUNT; p++) {
        placeOnEmpty(function (x,y) { items[key(x,y)] = { type: 'potion' }; });
      }
      // Герой
      placeOnEmpty(function (x,y) {
        hero = { x: x, y: y, hp: 100, maxHp: 100, atk: 5 };
      });
      // Противники
      for (let e = 0; e < ENEMY_COUNT; e++) {
        placeOnEmpty(function (x,y) {
          let en = { id: nextEnemyId++, x: x, y: y, hp: randInt(12, 30), atk: randInt(2, 6) };
          enemies.push(en);
        });
      }
    }
    // Рендер
    function render() {
      let $field = $('.field');
      $field.empty();
  
      // Рендер плиток
      for (let y = 0; y < MAP_H; y++) {
        for (let x = 0; x < MAP_W; x++) {
          let px = x * TILE_SIZE;
          let py = y * TILE_SIZE;
          let $tile = $('<div></div>').addClass('tile').css({ left: px + 'px', top: py + 'px' });
  
          if (map[y][x] === WALL) {
            $tile.addClass('tileW');
          } else {
            $tile.addClass('tile'); // пол
          }
  
          // предметы на полу: мечи, зелья 
          let it = items[key(x,y)];
          if (it) {
            if (it.type === 'sword') {
              $tile.addClass('tileSW');
            } else if (it.type === 'potion') {
              $tile.addClass('tileHP');
            }
          }
  
          // герой
          if (hero && hero.x === x && hero.y === y) {
            $tile.removeClass('tileE').addClass('tileP');
            // шкала здоровья героя
            let w = Math.max(0, Math.floor(100 * hero.hp / hero.maxHp));
            let $h = $('<div class="health"></div>').css({ width: w + '%' });
            $tile.append($h);
          } else {
            // врага на этой плитке?
            for (let i = 0; i < enemies.length; i++) {
              let en = enemies[i];
              if (en.x === x && en.y === y) {
                $tile.removeClass('tileE').addClass('tileE');
                // полоска здоровья
                let w2 = Math.max(0, Math.floor(100 * en.hp / 30));
                let $h2 = $('<div class="health"></div>').css({ width: w2 + '%' });
                $tile.append($h2);
              }
            }
          }
          $tile.removeClass('tilePortal');
          if (enemies.length === 0 && !portal) {
            spawnPortal();
          }
          if (portal && portal.x === x && portal.y === y) {
            $tile.addClass('tilePortal');
          }
          $field.append($tile)

        }
      }
      // UI
      updateHUD();
    }
  
    // GAME LOGIC
    function heroMove(dx, dy) {
      let nx = hero.x + dx;
      let ny = hero.y + dy;
      if (!inBounds(nx, ny)) return;
      if (map[ny][nx] === WALL) return; // запрет идти в стену
  
      // проверить присутствие противника - движение через противника блокировано
      for (let i = 0; i < enemies.length; i++) {
        if (enemies[i].x === nx && enemies[i].y === ny) {
          return;
        }
      }
  
      hero.x = nx;
      hero.y = ny;
  
      // Предметы
      let it = items[key(nx, ny)];
      if (it) {
        if (it.type === 'potion') {
          // {ил}
          hero.hp = Math.min(hero.maxHp, hero.hp + 30);
          delete items[key(nx, ny)];
        } else if (it.type === 'sword') {
          hero.atk += 5; // Увеличение атаки
          delete items[key(nx, ny)];
        }
      }
      if (portal && hero.x === portal.x && hero.y === portal.y) {
        // новый уровень
        portal = null; // удаляем старый портал
        genMap();      // генерируем новый уровень
        populate();
      }
    }
  
    function heroAttackAdjacent() {
      // атака ВСЕХ врагов на соседних клетках (4 направления)
      let adj = [ [1,0],[-1,0],[0,1],[0,-1] ];
      let killedIds = [];
      for (let i = 0; i < enemies.length; i++) {
        let en = enemies[i];
        for (let j = 0; j < adj.length; j++) {
          let nx = hero.x + adj[j][0];
          let ny = hero.y + adj[j][1];
          if (en.x === nx && en.y === ny) {
            // фактический урон
            let damage = Math.min(hero.atk, en.hp);
            en.hp -= damage;
            // Увеличиваем счёт
            score += damage;
            if (en.hp <= 0) {
              killedIds.push(en.id);

            }
          }
        }
      }
      // Удаление мертвых
      if (killedIds.length > 0) {
        enemies = enemies.filter(function (e) { return killedIds.indexOf(e.id) === -1; });
      }
    }
  
    function enemiesTurn() {
      // каждый враг: если находится рядом с героем -> атакует; иначе случайное перемещение (на 4 расстояния или 0)
      for (let i = 0; i < enemies.length; i++) {
        let e = enemies[i];
        let dx = hero.x - e.x;
        let dy = hero.y - e.y;
        if (Math.abs(dx) + Math.abs(dy) === 1) {
          // рядом -> атака героя
          hero.hp -= e.atk;
          if (hero.hp <= 0) {
            hero.hp = 0;
          }
          continue;
        }
  
        // случайное поведение: 50% шансов сделать случайный шаг, 50% - остаться
        if (Math.random() < 0.6) {
          // выбрать случайное направление
          let dirs = [ [1,0],[-1,0],[0,1],[0,-1] ];
          // случайный порядок, чтобы найти свободную ячейку
          let order = [0,1,2,3];
          for (let k = order.length - 1; k > 0; k--) {
            let ri = Math.floor(Math.random() * (k + 1));
            let tmp = order[k]; order[k] = order[ri]; order[ri] = tmp;
          }
          for (let ii = 0; ii < order.length; ii++) {
            let d = dirs[order[ii]];
            let nx2 = e.x + d[0];
            let ny2 = e.y + d[1];
            if (!inBounds(nx2, ny2)) continue;
            if (map[ny2][nx2] === WALL) continue;
            // не двигаться в сторону героя или другого врага
            if (hero.x === nx2 && hero.y === ny2) continue;
            let blocked = false;
            for (let j2 = 0; j2 < enemies.length; j2++) {
              if (j2 === i) continue;
              if (enemies[j2].x === nx2 && enemies[j2].y === ny2) { blocked = true; break; }
            }
            if (!blocked) {
              e.x = nx2;
              e.y = ny2;
              break;
            }
          }
        }
      }
  
      // очистка, если герой мертв
      if (hero.hp <= 0) {
        render();
        setTimeout(function () {
          alert(`Вы погибли! Игра окончена. \nСчёт: ${score} \nВремя: ${elapsed}`);
          // restart
          startGame();
        }, 20);
      }
    }
  
    // Управление
    function setupInput() {
      $(document).on('keydown.game', function (ev) {
        if (!hero) return;
        let code = ev.which || ev.keyCode;
        let moved = false;
        if (code === 87) { // W up
          heroMove(0, -1); moved = true;
        } else if (code === 65) { // A влево
          heroMove(-1, 0); moved = true;
        } else if (code === 83) { // S вниз
          heroMove(0, 1); moved = true;
        } else if (code === 68) { // D вправо
          heroMove(1, 0); moved = true;
        } else if (code === 32) { // SPACE атака
          ev.preventDefault();
          heroAttackAdjacent();
          // {од противников после атаки
          enemiesTurn();
          render();
          return;
        } else {
          return;
        }
  
        if (moved) {
          // После перемещения действие врага
          enemiesTurn();
          render();
        }
      });
    }
  
    // Старт
    function startGame() {
      adjustFieldBox()
      genMap();
      populate();
      score = 0;
      gameStartTime = Date.now();
      if (hudTimer) clearInterval(hudTimer);
      hudTimer = setInterval(updateHUD, 1000);
      render();
      updateHUD();
    }
  
    // init
    $(function () {
      setupInput();
      startGame();
      // debug
      window._gameState = {
        map: function () { return map; },
        items: function () { return items; },
        hero: function () { return hero; },
        enemies: function () { return enemies; }
      };
    });
  
  })();