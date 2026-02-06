class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.MAP_SIZE = 20;
        this.TILE_WIDTH = 64;
        this.TILE_HEIGHT = 32;
        this.tiles = [];
        this.enemies = [];
        this.player = null;
        this.isMoving = false;
        this.enemySpeed = 30;
        this.playerSpeed = 120;
        this.enemySightRange = 150;
        this.attackRange = 40;
        this.enemyCount = 5;
        this.TILE_CLICK_THRESHOLD = 50;
    }

    create() {
        // Create the isometric map
        this.createMap();
        
        // Create player
        this.createPlayer();
        
        // Create enemies
        this.createEnemies();
        
        // Setup input
        this.setupInput();
        
        // Setup camera
        this.cameras.main.setBounds(0, 0, 1600, 1200);
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        
        // Game UI text
        this.infoText = this.add.text(10, 10, 'Click to move. Get close to punch enemies!', {
            fontSize: '14px',
            fill: '#ffffff',
            backgroundColor: '#000000',
            padding: { x: 5, y: 5 }
        }).setScrollFactor(0).setDepth(1000);
    }

    createMap() {
        const offsetX = 400;
        const offsetY = 100;
        
        // Generate terrain types (0: floor, 1: highland, 2: water)
        const terrainMap = [];
        for (let y = 0; y < this.MAP_SIZE; y++) {
            terrainMap[y] = [];
            for (let x = 0; x < this.MAP_SIZE; x++) {
                // Create some variation in terrain
                let rand = Math.random();
                if (rand < 0.15) {
                    terrainMap[y][x] = 2; // water
                } else if (rand < 0.30) {
                    terrainMap[y][x] = 1; // highland
                } else {
                    terrainMap[y][x] = 0; // floor
                }
            }
        }
        
        // Create tiles
        for (let y = 0; y < this.MAP_SIZE; y++) {
            this.tiles[y] = [];
            for (let x = 0; x < this.MAP_SIZE; x++) {
                const isoPos = this.cartesianToIsometric(x, y);
                const posX = isoPos.x + offsetX;
                const posY = isoPos.y + offsetY;
                
                const terrain = terrainMap[y][x];
                let color = 0x8b7355; // floor (brown)
                let isWalkable = true;
                
                if (terrain === 1) {
                    color = 0x4a7c4e; // highland (green)
                } else if (terrain === 2) {
                    color = 0x4a90e2; // water (blue)
                    isWalkable = false;
                }
                
                // Draw isometric tile
                const tile = this.add.graphics();
                tile.fillStyle(color, 1);
                tile.fillPath();
                tile.beginPath();
                tile.moveTo(posX, posY);
                tile.lineTo(posX + this.TILE_WIDTH / 2, posY + this.TILE_HEIGHT / 2);
                tile.lineTo(posX, posY + this.TILE_HEIGHT);
                tile.lineTo(posX - this.TILE_WIDTH / 2, posY + this.TILE_HEIGHT / 2);
                tile.closePath();
                tile.fillPath();
                
                // Add border
                tile.lineStyle(1, 0x000000, 0.3);
                tile.strokePath();
                
                this.tiles[y][x] = {
                    graphics: tile,
                    cartX: x,
                    cartY: y,
                    isoX: posX,
                    isoY: posY,
                    walkable: isWalkable,
                    terrain: terrain
                };
            }
        }
    }

    createPlayer() {
        const startPos = this.getTileCenter(10, 10);
        
        // Create player as a simple colored shape
        const graphics = this.add.graphics();
        graphics.fillStyle(0x00ff00, 1);
        graphics.fillCircle(0, -15, 12);
        graphics.lineStyle(2, 0x00aa00, 1);
        graphics.strokeCircle(0, -15, 12);
        
        // Add container for player
        this.player = this.add.container(startPos.x, startPos.y);
        this.player.add(graphics);
        this.player.setSize(24, 24);
        this.physics.world.enable(this.player);
        this.player.body.setCircle(12);
        this.player.body.setOffset(-12, -27);
        
        this.player.cartX = 10;
        this.player.cartY = 10;
        this.player.health = 100;
        this.player.isAttacking = false;
        this.player.attackCooldown = 0;
        
        this.player.setDepth(100);
    }

    createEnemies() {
        // Place enemies at random walkable positions
        for (let i = 0; i < this.enemyCount; i++) {
            let x, y;
            let attempts = 0;
            
            // Find a walkable tile
            do {
                x = Phaser.Math.Between(0, this.MAP_SIZE - 1);
                y = Phaser.Math.Between(0, this.MAP_SIZE - 1);
                attempts++;
            } while ((!this.tiles[y][x].walkable || (x === 10 && y === 10)) && attempts < 100);
            
            if (attempts >= 100) continue;
            
            const pos = this.getTileCenter(x, y);
            
            // Create enemy as red circle
            const graphics = this.add.graphics();
            graphics.fillStyle(0xff0000, 1);
            graphics.fillCircle(0, -15, 10);
            graphics.lineStyle(2, 0xaa0000, 1);
            graphics.strokeCircle(0, -15, 10);
            
            const enemy = this.add.container(pos.x, pos.y);
            enemy.add(graphics);
            enemy.setSize(20, 20);
            this.physics.world.enable(enemy);
            enemy.body.setCircle(10);
            enemy.body.setOffset(-10, -25);
            
            enemy.cartX = x;
            enemy.cartY = y;
            enemy.health = 50;
            enemy.wanderTimer = 0;
            enemy.wanderDelay = Phaser.Math.Between(1000, 3000);
            enemy.attackCooldown = 0;
            enemy.isChasing = false;
            enemy.isDead = false;
            
            enemy.setDepth(100);
            
            this.enemies.push(enemy);
        }
    }

    setupInput() {
        this.input.on('pointerdown', (pointer) => {
            // Convert screen to world coordinates
            const worldX = pointer.worldX;
            const worldY = pointer.worldY;
            
            // Find closest tile
            const tile = this.findClosestTile(worldX, worldY);
            
            if (tile && tile.walkable && !this.isMoving) {
                this.movePlayerToTile(tile);
            }
        });
    }

    findClosestTile(worldX, worldY) {
        let closestTile = null;
        let minDist = Infinity;
        
        for (let y = 0; y < this.MAP_SIZE; y++) {
            for (let x = 0; x < this.MAP_SIZE; x++) {
                const tile = this.tiles[y][x];
                const dist = Phaser.Math.Distance.Between(worldX, worldY, tile.isoX, tile.isoY);
                
                if (dist < minDist && dist < this.TILE_CLICK_THRESHOLD) {
                    minDist = dist;
                    closestTile = tile;
                }
            }
        }
        
        return closestTile;
    }

    movePlayerToTile(tile) {
        const targetPos = this.getTileCenter(tile.cartX, tile.cartY);
        this.isMoving = true;
        
        this.physics.moveTo(this.player, targetPos.x, targetPos.y, this.playerSpeed);
        
        // Store target for stopping
        this.player.targetX = targetPos.x;
        this.player.targetY = targetPos.y;
        this.player.targetCartX = tile.cartX;
        this.player.targetCartY = tile.cartY;
    }

    getTileCenter(cartX, cartY) {
        const tile = this.tiles[cartY][cartX];
        return { x: tile.isoX, y: tile.isoY + this.TILE_HEIGHT / 2 };
    }

    cartesianToIsometric(cartX, cartY) {
        return {
            x: (cartX - cartY) * (this.TILE_WIDTH / 2),
            y: (cartX + cartY) * (this.TILE_HEIGHT / 2)
        };
    }

    update(time, delta) {
        // Update player movement
        if (this.isMoving && this.player.targetX !== undefined) {
            const dist = Phaser.Math.Distance.Between(
                this.player.x, this.player.y,
                this.player.targetX, this.player.targetY
            );
            
            if (dist < 5) {
                this.player.body.setVelocity(0, 0);
                this.player.x = this.player.targetX;
                this.player.y = this.player.targetY;
                this.player.cartX = this.player.targetCartX;
                this.player.cartY = this.player.targetCartY;
                this.isMoving = false;
            }
        }
        
        // Update enemies
        this.enemies.forEach((enemy, index) => {
            if (enemy.isDead) return;
            
            const distToPlayer = Phaser.Math.Distance.Between(
                enemy.x, enemy.y,
                this.player.x, this.player.y
            );
            
            // Check if player is in sight
            if (distToPlayer < this.enemySightRange) {
                enemy.isChasing = true;
                
                // Move towards player
                this.physics.moveTo(enemy, this.player.x, this.player.y, this.enemySpeed);
                
                // Attack if in range
                if (distToPlayer < this.attackRange) {
                    // Update attack cooldown only if positive
                    if (enemy.attackCooldown > 0) {
                        enemy.attackCooldown -= delta;
                    }
                    
                    // Enemy attacks with cooldown
                    if (enemy.attackCooldown <= 0) {
                        this.infoText.setText('Enemy is attacking you!');
                        enemy.attackCooldown = 1000; // 1 second cooldown
                    }
                }
            } else {
                enemy.isChasing = false;
                
                // Wander behavior
                enemy.wanderTimer += delta;
                
                if (enemy.wanderTimer > enemy.wanderDelay) {
                    enemy.wanderTimer = 0;
                    enemy.wanderDelay = Phaser.Math.Between(2000, 4000);
                    
                    // Pick random nearby walkable tile
                    let newX = enemy.cartX + Phaser.Math.Between(-2, 2);
                    let newY = enemy.cartY + Phaser.Math.Between(-2, 2);
                    
                    // Clamp to map bounds
                    newX = Phaser.Math.Clamp(newX, 0, this.MAP_SIZE - 1);
                    newY = Phaser.Math.Clamp(newY, 0, this.MAP_SIZE - 1);
                    
                    if (this.tiles[newY][newX].walkable) {
                        const targetPos = this.getTileCenter(newX, newY);
                        enemy.targetX = targetPos.x;
                        enemy.targetY = targetPos.y;
                        enemy.targetCartX = newX;
                        enemy.targetCartY = newY;
                        
                        this.physics.moveTo(enemy, targetPos.x, targetPos.y, this.enemySpeed);
                    }
                }
                
                // Check if reached wander target
                if (enemy.targetX !== undefined) {
                    const dist = Phaser.Math.Distance.Between(
                        enemy.x, enemy.y,
                        enemy.targetX, enemy.targetY
                    );
                    
                    if (dist < 5) {
                        enemy.body.setVelocity(0, 0);
                        enemy.cartX = enemy.targetCartX;
                        enemy.cartY = enemy.targetCartY;
                        enemy.targetX = undefined;
                    }
                }
            }
            
            // Update depth based on Y position for proper layering
            enemy.setDepth(100 + enemy.y);
        });
        
        // Update player depth
        this.player.setDepth(100 + this.player.y);
        
        // Update player attack cooldown
        if (this.player.attackCooldown > 0) {
            this.player.attackCooldown -= delta;
        }
        
        // Auto-attack nearby enemies
        if (!this.isMoving && this.player.attackCooldown <= 0) {
            this.enemies.forEach(enemy => {
                if (enemy.isDead) return;
                
                const dist = Phaser.Math.Distance.Between(
                    enemy.x, enemy.y,
                    this.player.x, this.player.y
                );
                
                if (dist < this.attackRange) {
                    this.playerAttack();
                }
            });
        }
    }

    playerAttack() {
        if (this.player.isAttacking) return;
        
        this.player.isAttacking = true;
        
        // Find enemies in range
        let hitEnemy = false;
        this.enemies.forEach(enemy => {
            if (enemy.isDead) return;
            
            const dist = Phaser.Math.Distance.Between(
                enemy.x, enemy.y,
                this.player.x, this.player.y
            );
            
            if (dist < this.attackRange) {
                hitEnemy = true;
                enemy.health -= 25;
                
                // Flash enemy red
                enemy.list[0].clear();
                enemy.list[0].fillStyle(0xffaaaa, 1);
                enemy.list[0].fillCircle(0, -15, 10);
                
                this.time.delayedCall(100, () => {
                    if (enemy.health <= 0) {
                        enemy.isDead = true;
                        enemy.destroy();
                        this.infoText.setText('Enemy defeated!');
                    } else {
                        enemy.list[0].clear();
                        enemy.list[0].fillStyle(0xff0000, 1);
                        enemy.list[0].fillCircle(0, -15, 10);
                        enemy.list[0].lineStyle(2, 0xaa0000, 1);
                        enemy.list[0].strokeCircle(0, -15, 10);
                    }
                });
            }
        });
        
        if (hitEnemy) {
            this.infoText.setText('Player punches enemy!');
            // Set cooldown
            this.player.attackCooldown = 500; // 0.5 second cooldown
        }
        
        // Reset attack flag after animation
        this.time.delayedCall(200, () => {
            this.player.isAttacking = false;
        });
    }
}

export default GameScene;
