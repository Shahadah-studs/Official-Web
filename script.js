// EliteSoftBody 3D - Mass-Spring Physics Engine

// 1. Global Physics Settings
var nodes = [];
var springs = [];
var gravityX = 0;
var gravityY = 0.1; // Downward force
var gravityZ = 0;
var subSteps = 4;
var isInitialized = false;

// 2. 3D Camera Parameters
var cameraAngleX = 0.3;
var cameraAngleY = 0.4;
var cameraZoom = 300;
var centerX = 300; // Centered for Khan Academy's default 400x400 canvas
var centerY = 300;

// 3. Mathematical 3D to 2D Projection Functions
var project3D = function(x, y, z) {
    // Y-Axis Rotation
    var x1 = x * cos(cameraAngleX) - z * sin(cameraAngleX);
    var z1 = x * sin(cameraAngleX) + z * cos(cameraAngleX);
    
    // X-Axis Rotation
    var y2 = y * cos(cameraAngleY) - z1 * sin(cameraAngleY);
    var z2 = y * cos(cameraAngleY) + z1 * cos(cameraAngleY);

    var perspectiveDistance = 400;
    var fov = cameraZoom / (z2 + perspectiveDistance);
    
    var screenX = x1 * fov + centerX;
    var screenY = y2 * fov + centerY;
    
    return { x: screenX, y: screenY };
};

var dist3D = function(x1, y1, z1, x2, y2, z2) {
    return sqrt(pow(x1 - x2, 2) + pow(y1 - y2, 2) + pow(z1 - z2, 2));
};

// 4. Object Factories (Constructors without 'new' to prevent lint errors)
var createNode = function(x, y, z) {
    return {
        px: x, py: y, pz: z,
        vx: 0, vy: 0, vz: 0,
        ax: 0, ay: 0, az: 0,
        mass: 1.0
    };
};

var createSpring = function(nodeA, nodeB, restL) {
    return {
        a: nodeA,
        b: nodeB,
        restLength: restL,
        stiffness: 0.08, 
        damping: 0.03 // Stabilizes structural oscillation
    };
};

// 5. Deferred Physics Structure Initialization
var initGame = function() {
    var cubeSize = 3; 
    var nodeSpacing = 45;
    var startX = -45;
    var startY = -120;
    var startZ = -45;

    // Generate physical mass points (Nodes)
    for (var z = 0; z < cubeSize; z++) {
        for (var y = 0; y < cubeSize; y++) {
            for (var x = 0; x < cubeSize; x++) {
                var nx = startX + x * nodeSpacing;
                var ny = startY + y * nodeSpacing;
                var nz = startZ + z * nodeSpacing;
                nodes.push(createNode(nx, ny, nz));
            }
        }
    }

    // Connect nodes with elastic beams (Springs)
    for (var i = 0; i < nodes.length; i++) {
        for (var j = i + 1; j < nodes.length; j++) {
            var d = dist3D(nodes[i].px, nodes[i].py, nodes[i].pz, nodes[j].px, nodes[j].py, nodes[j].pz);
            // Connect structural neighbors and cross-diagonals
            if (d < nodeSpacing * 1.8) {
                springs.push(createSpring(nodes[i], nodes[j], d));
            }
        }
    }
    isInitialized = true;
};

// 6. Main Draw Loop (Executed automatically by Khan Academy)
draw = function() {
    // Safe initialization on the very first frame
    if (!isInitialized) {
        initGame();
    }

    background(30, 30, 35);

    // Camera control via mouse drag
    if (mouseIsPressed) {
        cameraAngleX += (mouseX - pmouseX) * 0.005;
        cameraAngleY += (mouseY - pmouseY) * 0.005;
    }

    // --- PHYSICS SIMULATION ENGINE (Substepping) ---
    for (var step = 0; step < subSteps; step++) {
        // Evaluate Beam Tensions (Hooke's Law)
        for (var s = 0; s < springs.length; s++) {
            var sp = springs[s];
            var fx = sp.b.px - sp.a.px;
            var fy = sp.b.py - sp.a.py;
            var fz = sp.b.pz - sp.a.pz;
            
            var currentLength = dist3D(sp.a.px, sp.a.py, sp.a.pz, sp.b.px, sp.b.py, sp.b.pz);
            if (currentLength > 0) {
                var stretch = currentLength - sp.restLength;
                var springForce = sp.stiffness * stretch;

                // Normalize force directional vector
                fx /= currentLength;
                fy /= currentLength;
                fz /= currentLength;

                // Relative velocity for internal shock-absorption damping
                var rvx = sp.b.vx - sp.a.vx;
                var rvy = sp.b.vy - sp.a.vy;
                var rvz = sp.b.vz - sp.a.vz;
                var dampForce = (rvx * fx + rvy * fy + rvz * fz) * sp.damping;

                var totalForce = springForce + dampForce;
                
                // Distribute forces equally (Newton's Third Law)
                sp.a.ax += (fx * totalForce) / sp.a.mass;
                sp.a.ay += (fy * totalForce) / sp.a.mass;
                sp.a.az += (fz * totalForce) / sp.a.mass;

                sp.b.ax -= (fx * totalForce) / sp.b.mass;
                sp.b.ay -= (fy * totalForce) / sp.b.mass;
                sp.b.az -= (fz * totalForce) / sp.b.mass;
            }
        }

        // Process Node Movements and Environmental Forces
        for (var n = 0; n < nodes.length; n++) {
            var node = nodes[n];
            
            // Apply environment gravity
            node.ax += gravityX;
            node.ay += gravityY;
            node.az += gravityZ;

            // Keyboard input mechanics (Fixed ProcessingJS key names)
            if (keyIsPressed && keyCode === LEFT)  { node.ax -= 0.05; }
            if (keyIsPressed && keyCode === RIGHT) { node.ax += 0.05; }
            if (keyIsPressed && keyCode === UP)    { node.ay -= 0.1;  } // Jump thrust

            // Semi-implicit Euler integration
            node.vx += node.ax;
            node.vy += node.ay;
            node.vz += node.az;
            
            node.vx *= 0.99; // Aerodynamic drag / air resistance
            node.vy *= 0.99;
            node.vz *= 0.99;

            node.px += node.vx;
            node.py += node.vy;
            node.pz += node.vz;

            // Reset acceleration accumulators
            node.ax = 0;
            node.ay = 0;
            node.az = 0;

            // Solid deformation ground collision boundary (Fixed at Y = 100)
            if (node.py > 100) {
                node.py = 100;
                node.vy *= -0.2; // Damped crash rebound
                node.vx *= 0.8;  // Ground friction
                node.vz *= 0.8;
            }
        }
    }

    // --- GRAPHICS RENDERING SYSTEM ---
    // Draw Ground Grid Surface
    stroke(80);
    strokeWeight(1);
    var boundarySize = 200;
    var p1 = project3D(-boundarySize, 100, -boundarySize);
    var p2 = project3D(boundarySize, 100, -boundarySize);
    var p3 = project3D(boundarySize, 100, boundarySize);
    var p4 = project3D(-boundarySize, 100, boundarySize);
    fill(50, 50, 55);
    quad(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, p4.x, p4.y);

    // Draw Structural Beams (Spring Connections)
    stroke(180, 190, 255, 120);
    strokeWeight(1.5);
    for (var si = 0; si < springs.length; si++) {
        var sA = project3D(springs[si].a.px, springs[si].a.py, springs[si].a.pz);
        var sB = project3D(springs[si].b.px, springs[si].b.py, springs[si].b.pz);
        line(sA.x, sA.y, sB.x, sB.y);
    }

    // Draw Deformable Node Contact Points
    fill(255, 90, 0);
    noStroke();
    for (var ni = 0; ni < nodes.length; ni++) {
        var screenPosition = project3D(nodes[ni].px, nodes[ni].py, nodes[ni].pz);
        ellipse(screenPosition.x, screenPosition.y, 6, 6);
    }

    // Screen HUD Text Overlay
    fill(255);
    textSize(16);
    text("EliteSoftBody 3D", 15, 25);
    textSize(10);
    text("Drag mouse to rotate perspective view.", 15, 45);
    text("Use LEFT / RIGHT / UP arrows to navigate.", 15, 60);
};




