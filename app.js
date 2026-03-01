// ========================================
// HVS-GNN Interactive Paper Explorer
// Three.js Visualizations & Interactivity
// ========================================

// ---- Utility ----
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// ---- Navigation & Scroll ----
const navbar = document.getElementById('navbar');
const progressBar = document.getElementById('progress-bar');
const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('.section');

window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = (scrollY / docHeight) * 100;
    progressBar.style.width = progress + '%';

    navbar.classList.toggle('scrolled', scrollY > 50);

    // Active nav link
    let current = '';
    sections.forEach(section => {
        const top = section.offsetTop - 200;
        if (scrollY >= top) current = section.getAttribute('id');
    });
    navLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === '#' + current);
    });
});

// ---- Intersection Observer for fade-in ----
const fadeElements = document.querySelectorAll('.problem-card, .variant-card, .takeaway-card, .metric-card, .config-card');
fadeElements.forEach(el => el.classList.add('fade-in'));

const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, { threshold: 0.1 });

fadeElements.forEach(el => fadeObserver.observe(el));

// ---- Metric Counter Animation ----
const metricCards = document.querySelectorAll('.metric-value[data-target]');
const metricObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const el = entry.target;
            const target = parseInt(el.dataset.target);
            const suffix = el.dataset.suffix || '%';
            let current = 0;
            const increment = target / 60;
            const timer = setInterval(() => {
                current += increment;
                if (current >= target) {
                    current = target;
                    clearInterval(timer);
                }
                el.textContent = Math.round(current) + suffix;
            }, 16);
            metricObserver.unobserve(el);
        }
    });
}, { threshold: 0.5 });
metricCards.forEach(el => metricObserver.observe(el));

// ---- GNN Step Controls ----
document.querySelectorAll('.control-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.control-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const step = btn.dataset.step;
        document.querySelectorAll('.step-content').forEach(s => s.classList.remove('active'));
        document.getElementById('step-' + step).classList.add('active');
        if (gnnViz) gnnViz.setStep(step);
    });
});

// ---- Example Tabs ----
const exampleInited = { '1': true, '2': false, '3': false };
document.querySelectorAll('.example-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.example-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const ex = tab.dataset.example;
        document.querySelectorAll('.example-content').forEach(c => c.classList.remove('active'));
        document.getElementById('example-' + ex).classList.add('active');
        // Lazy-init Three.js scenes for hidden tabs
        if (!exampleInited[ex]) {
            exampleInited[ex] = true;
            if (ex === '2') initExample2();
            if (ex === '3') initExample3();
        }
    });
});


// ========================================
// THREE.JS VISUALIZATIONS
// ========================================

// ---- 1. Hero Background: Animated Neural Graph ----
(function initHero() {
    const container = document.getElementById('hero-canvas-container');
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.z = 30;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Create nodes
    const nodeCount = 80;
    const nodes = [];
    const nodeGeo = new THREE.SphereGeometry(0.2, 16, 16);

    for (let i = 0; i < nodeCount; i++) {
        const mat = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(0.7 + Math.random() * 0.15, 0.7, 0.6),
            transparent: true,
            opacity: 0.8
        });
        const mesh = new THREE.Mesh(nodeGeo, mat);
        mesh.position.set(
            (Math.random() - 0.5) * 40,
            (Math.random() - 0.5) * 25,
            (Math.random() - 0.5) * 20
        );
        mesh.userData = {
            vel: new THREE.Vector3(
                (Math.random() - 0.5) * 0.01,
                (Math.random() - 0.5) * 0.01,
                (Math.random() - 0.5) * 0.01
            ),
            baseScale: 0.5 + Math.random() * 1.5,
            phase: Math.random() * Math.PI * 2
        };
        scene.add(mesh);
        nodes.push(mesh);
    }

    // Create edges
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x6366f1, transparent: true, opacity: 0.15 });
    const edges = [];

    for (let i = 0; i < nodeCount; i++) {
        for (let j = i + 1; j < nodeCount; j++) {
            const dist = nodes[i].position.distanceTo(nodes[j].position);
            if (dist < 8) {
                const geo = new THREE.BufferGeometry().setFromPoints([
                    nodes[i].position.clone(),
                    nodes[j].position.clone()
                ]);
                const line = new THREE.Line(geo, edgeMat);
                scene.add(line);
                edges.push({ line, i, j });
            }
        }
    }

    // Spike particles
    const spikeMat = new THREE.PointsMaterial({
        color: 0x34d399,
        size: 0.4,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });
    const spikePositions = new Float32Array(300);
    const spikeGeo = new THREE.BufferGeometry();
    spikeGeo.setAttribute('position', new THREE.BufferAttribute(spikePositions, 3));
    const spikes = new THREE.Points(spikeGeo, spikeMat);
    scene.add(spikes);

    let spikeIdx = 0;
    let time = 0;

    function animate() {
        requestAnimationFrame(animate);
        time += 0.005;

        nodes.forEach((node, idx) => {
            node.position.add(node.userData.vel);
            // Bounce
            ['x', 'y', 'z'].forEach(axis => {
                const limit = axis === 'x' ? 22 : axis === 'y' ? 14 : 12;
                if (Math.abs(node.position[axis]) > limit) node.userData.vel[axis] *= -1;
            });
            const s = node.userData.baseScale * (1 + 0.3 * Math.sin(time * 2 + node.userData.phase));
            node.scale.setScalar(s);
        });

        // Update edges
        edges.forEach(e => {
            const positions = e.line.geometry.attributes.position.array;
            positions[0] = nodes[e.i].position.x;
            positions[1] = nodes[e.i].position.y;
            positions[2] = nodes[e.i].position.z;
            positions[3] = nodes[e.j].position.x;
            positions[4] = nodes[e.j].position.y;
            positions[5] = nodes[e.j].position.z;
            e.line.geometry.attributes.position.needsUpdate = true;
        });

        // Spike travel particles
        if (Math.random() < 0.3 && edges.length > 0) {
            const e = edges[Math.floor(Math.random() * edges.length)];
            const t = Math.random();
            const pos = new THREE.Vector3().lerpVectors(nodes[e.i].position, nodes[e.j].position, t);
            spikePositions[spikeIdx * 3] = pos.x;
            spikePositions[spikeIdx * 3 + 1] = pos.y;
            spikePositions[spikeIdx * 3 + 2] = pos.z;
            spikeIdx = (spikeIdx + 1) % 100;
            spikeGeo.attributes.position.needsUpdate = true;
        }

        camera.position.x = Math.sin(time * 0.3) * 3;
        camera.position.y = Math.cos(time * 0.2) * 2;
        camera.lookAt(0, 0, 0);

        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
})();


// ---- 2. GNN Message Passing Visualization ----
let gnnViz = null;
(function initGNN() {
    const container = document.getElementById('gnn-canvas');
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x08080f);
    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 14);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = false;

    // Graph nodes in a nice layout
    const nodePositions = [
        [-3, 2, 0], [0, 3, 0], [3, 2, 0],
        [-4, -1, 0], [-1, -1, 0], [2, -1, 0], [4, 0, 0],
        [-2, -3.5, 0], [1, -3, 0], [3.5, -3, 0]
    ];

    const edgePairs = [
        [0, 1], [1, 2], [0, 3], [0, 4], [1, 4], [1, 5], [2, 5], [2, 6],
        [3, 4], [3, 7], [4, 5], [4, 7], [4, 8], [5, 6], [5, 8], [5, 9],
        [6, 9], [7, 8], [8, 9]
    ];

    const nodeColors = [
        0x6366f1, 0x8b5cf6, 0xa78bfa, 0x6366f1, 0xfbbf24,
        0x8b5cf6, 0xa78bfa, 0x6366f1, 0x8b5cf6, 0xa78bfa
    ];

    const nodeMeshes = [];
    const nodeGeo = new THREE.SphereGeometry(0.45, 32, 32);

    nodePositions.forEach((pos, i) => {
        const mat = new THREE.MeshBasicMaterial({
            color: nodeColors[i],
            transparent: true,
            opacity: 0.9
        });
        const mesh = new THREE.Mesh(nodeGeo, mat);
        mesh.position.set(...pos);
        scene.add(mesh);
        nodeMeshes.push(mesh);
    });

    // Edges
    const edgeLines = [];
    const edgeBaseMat = new THREE.LineBasicMaterial({ color: 0x4444aa, transparent: true, opacity: 0.3 });

    edgePairs.forEach(([i, j]) => {
        const geo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(...nodePositions[i]),
            new THREE.Vector3(...nodePositions[j])
        ]);
        const line = new THREE.Line(geo, edgeBaseMat.clone());
        scene.add(line);
        edgeLines.push({ line, from: i, to: j });
    });

    // Message particles
    const msgGroup = new THREE.Group();
    scene.add(msgGroup);
    let messageParticles = [];

    // Highlight rings
    const ringGeo = new THREE.RingGeometry(0.55, 0.75, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0, side: THREE.DoubleSide });
    const highlightRings = [];
    nodeMeshes.forEach(node => {
        const ring = new THREE.Mesh(ringGeo, ringMat.clone());
        ring.position.copy(node.position);
        scene.add(ring);
        highlightRings.push(ring);
    });

    let currentStep = 'graph';
    let time = 0;
    const targetNode = 4; // Center node for demo

    gnnViz = {
        setStep(step) {
            currentStep = step;
            messageParticles.forEach(p => msgGroup.remove(p));
            messageParticles = [];
        }
    };

    function animate() {
        requestAnimationFrame(animate);
        time += 0.016;
        controls.update();

        // Reset visuals
        nodeMeshes.forEach((n, i) => {
            n.scale.setScalar(1 + 0.05 * Math.sin(time * 2 + i));
        });
        highlightRings.forEach(r => { r.material.opacity = 0; });
        edgeLines.forEach(e => {
            e.line.material.opacity = 0.3;
            e.line.material.color.set(0x4444aa);
        });

        const neighbors = [];
        edgePairs.forEach(([i, j]) => {
            if (i === targetNode) neighbors.push(j);
            if (j === targetNode) neighbors.push(i);
        });

        if (currentStep === 'message' || currentStep === 'aggregate' || currentStep === 'update') {
            // Highlight target node
            highlightRings[targetNode].material.opacity = 0.6;
            highlightRings[targetNode].rotation.z = time;

            // Highlight neighbor edges
            edgeLines.forEach(e => {
                if (e.from === targetNode || e.to === targetNode) {
                    e.line.material.opacity = 0.8;
                    e.line.material.color.set(0xfbbf24);
                }
            });

            // Highlight neighbor nodes
            neighbors.forEach(n => {
                nodeMeshes[n].scale.setScalar(1.2 + 0.1 * Math.sin(time * 3));
            });
        }

        if (currentStep === 'message') {
            // Animate message particles from neighbors to target
            if (messageParticles.length === 0) {
                neighbors.forEach(n => {
                    const geo = new THREE.SphereGeometry(0.15, 8, 8);
                    const mat = new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.9 });
                    const particle = new THREE.Mesh(geo, mat);
                    particle.userData = { from: n, progress: Math.random() };
                    msgGroup.add(particle);
                    messageParticles.push(particle);
                });
            }
            messageParticles.forEach(p => {
                p.userData.progress = (p.userData.progress + 0.008) % 1;
                const from = nodeMeshes[p.userData.from].position;
                const to = nodeMeshes[targetNode].position;
                p.position.lerpVectors(from, to, p.userData.progress);
                p.material.opacity = Math.sin(p.userData.progress * Math.PI);
            });
        }

        if (currentStep === 'aggregate') {
            // Particles converge to target
            if (messageParticles.length === 0) {
                neighbors.forEach(n => {
                    const geo = new THREE.SphereGeometry(0.15, 8, 8);
                    const mat = new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.9 });
                    const particle = new THREE.Mesh(geo, mat);
                    particle.userData = { from: n, progress: 0 };
                    msgGroup.add(particle);
                    messageParticles.push(particle);
                });
            }
            messageParticles.forEach(p => {
                p.userData.progress = Math.min(p.userData.progress + 0.005, 1);
                const from = nodeMeshes[p.userData.from].position;
                const to = nodeMeshes[targetNode].position;
                p.position.lerpVectors(from, to, p.userData.progress);
                if (p.userData.progress > 0.9) {
                    p.material.opacity = (1 - p.userData.progress) * 10;
                }
            });
            // Grow target
            const scale = 1 + 0.5 * Math.sin(time * 3);
            nodeMeshes[targetNode].scale.setScalar(scale);
        }

        if (currentStep === 'update') {
            // Pulse outward from target
            const pulse = Math.sin(time * 4);
            nodeMeshes[targetNode].scale.setScalar(1.3 + 0.3 * pulse);
            nodeMeshes[targetNode].material.color.set(0x34d399);
            highlightRings[targetNode].material.color.set(0x34d399);
            highlightRings[targetNode].scale.setScalar(1 + 0.5 * Math.max(0, pulse));
        }

        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
})();


// ---- 3. LIF Neuron Visualization ----
(function initLIF() {
    const container = document.getElementById('lif-canvas');
    if (!container) return;

    const canvas = document.createElement('canvas');
    canvas.width = container.clientWidth * 2;
    canvas.height = 400;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const w = canvas.width;
    const h = canvas.height;
    let time = 0;
    const beta = 0.85;
    const threshold = 0.7;

    function drawLIF() {
        ctx.clearRect(0, 0, w, h);

        // Background grid
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.05)';
        ctx.lineWidth = 1;
        for (let y = 0; y < h; y += 40) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }

        // Threshold line
        const thY = h - threshold * h * 0.7 - 40;
        ctx.strokeStyle = 'rgba(248, 113, 113, 0.4)';
        ctx.setLineDash([8, 6]);
        ctx.beginPath(); ctx.moveTo(0, thY); ctx.lineTo(w, thY); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(248, 113, 113, 0.6)';
        ctx.font = '20px Inter';
        ctx.fillText('Threshold Tₕ', 10, thY - 8);

        // Simulate LIF
        let membrane = 0;
        const points = [];
        const spikes = [];
        const inputs = [0.3, 0.4, 0.5, 0.6, 0.2, 0.7, 0.3, 0.8, 0.1, 0.5, 0.6, 0.4, 0.9, 0.2, 0.7, 0.5, 0.3, 0.8, 0.6, 0.4];
        const totalSteps = 200;

        for (let t = 0; t < totalSteps; t++) {
            const input = inputs[t % inputs.length] * (0.5 + 0.5 * Math.sin(time * 2 + t * 0.2));
            membrane = beta * membrane + input * 0.35;
            if (membrane >= threshold) {
                spikes.push(t);
                membrane = 0;
            }
            points.push(membrane);
        }

        // Draw membrane potential
        ctx.strokeStyle = '#8b5cf6';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i < points.length; i++) {
            const x = (i / totalSteps) * w;
            const y = h - points[i] * h * 0.7 - 40;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Draw binary spikes
        spikes.forEach(t => {
            const x = (t / totalSteps) * w;
            ctx.strokeStyle = '#f87171';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x, h - 40);
            ctx.lineTo(x, 20);
            ctx.stroke();

            // Spike marker
            ctx.fillStyle = '#f87171';
            ctx.beginPath();
            ctx.arc(x, 20, 5, 0, Math.PI * 2);
            ctx.fill();
        });

        // Labels
        ctx.fillStyle = '#8b5cf6';
        ctx.font = '18px Inter';
        ctx.fillText('Membrane Potential', 10, h - 10);
        ctx.fillStyle = '#f87171';
        ctx.fillText('Binary Spike (0/1)', w - 230, h - 10);

        time += 0.01;
        requestAnimationFrame(drawLIF);
    }
    drawLIF();
})();


// ---- 4. VSN Visualization ----
(function initVSN() {
    const container = document.getElementById('vsn-canvas');
    if (!container) return;

    const canvas = document.createElement('canvas');
    canvas.width = container.clientWidth * 2;
    canvas.height = 400;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const w = canvas.width;
    const h = canvas.height;
    let time = 0;
    const beta = 0.85;
    const threshold = 0.7;

    function drawVSN() {
        ctx.clearRect(0, 0, w, h);

        // Background grid
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.05)';
        ctx.lineWidth = 1;
        for (let y = 0; y < h; y += 40) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }

        // Threshold
        const thY = h - threshold * h * 0.7 - 40;
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.4)';
        ctx.setLineDash([8, 6]);
        ctx.beginPath(); ctx.moveTo(0, thY); ctx.lineTo(w, thY); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(52, 211, 153, 0.6)';
        ctx.font = '20px Inter';
        ctx.fillText('Threshold Tₕ', 10, thY - 8);

        let membrane = 0;
        const points = [];
        const gradedSpikes = [];
        const inputs = [0.3, 0.4, 0.5, 0.6, 0.2, 0.7, 0.3, 0.8, 0.1, 0.5, 0.6, 0.4, 0.9, 0.2, 0.7, 0.5, 0.3, 0.8, 0.6, 0.4];
        const totalSteps = 200;

        for (let t = 0; t < totalSteps; t++) {
            const input = inputs[t % inputs.length] * (0.5 + 0.5 * Math.sin(time * 2 + t * 0.2));
            membrane = beta * membrane + input * 0.35;
            if (membrane >= threshold) {
                // Graded spike: σ(z * ỹ) where ỹ=1, so σ(z)
                const gradedValue = Math.tanh(input * 2); // continuous activation
                gradedSpikes.push({ t, value: gradedValue, input });
                membrane = 0;
            }
            points.push(membrane);
        }

        // Draw membrane
        ctx.strokeStyle = '#8b5cf6';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i < points.length; i++) {
            const x = (i / totalSteps) * w;
            const y = h - points[i] * h * 0.7 - 40;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Draw graded spikes (variable height!)
        gradedSpikes.forEach(spike => {
            const x = (spike.t / totalSteps) * w;
            const spikeHeight = spike.value * (h - 60);

            // Gradient spike bar
            const grad = ctx.createLinearGradient(x, h - 40, x, h - 40 - spikeHeight);
            grad.addColorStop(0, 'rgba(52, 211, 153, 0.3)');
            grad.addColorStop(1, 'rgba(52, 211, 153, 0.9)');
            ctx.strokeStyle = grad;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(x, h - 40);
            ctx.lineTo(x, h - 40 - spikeHeight);
            ctx.stroke();

            // Value label
            ctx.fillStyle = '#34d399';
            ctx.font = '16px JetBrains Mono';
            ctx.fillText(spike.value.toFixed(2), x + 5, h - 40 - spikeHeight + 5);

            // Spike top marker
            ctx.beginPath();
            ctx.arc(x, h - 40 - spikeHeight, 5, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.fillStyle = '#8b5cf6';
        ctx.font = '18px Inter';
        ctx.fillText('Membrane Potential', 10, h - 10);
        ctx.fillStyle = '#34d399';
        ctx.fillText('Graded Spikes (variable height)', w - 380, h - 10);

        time += 0.01;
        requestAnimationFrame(drawVSN);
    }
    drawVSN();
})();


// ---- 5. Surrogate Gradient Visualization ----
(function initSurrogate() {
    const container = document.getElementById('surrogate-canvas');
    if (!container) return;

    const canvas = document.createElement('canvas');
    canvas.width = container.clientWidth * 2;
    canvas.height = 600;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    let time = 0;

    function heaviside(x) { return x >= 0 ? 1 : 0; }
    function fastSigmoid(x) { return 1 / (1 + Math.abs(x * 5)); }

    function draw() {
        ctx.clearRect(0, 0, w, h);

        // Axes
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(40, cy); ctx.lineTo(w - 40, cy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, 30); ctx.lineTo(cx, h - 30); ctx.stroke();

        // Labels
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '20px Inter';
        ctx.fillText('Membrane Potential →', w - 260, cy + 30);
        ctx.fillText('0', cx + 8, cy + 25);

        const scaleX = (w - 80) / 8;
        const scaleY = (h - 60) / 2.5;

        // Forward: Step function
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let px = 40; px < w - 40; px++) {
            const x = (px - cx) / scaleX;
            const y = heaviside(x);
            const py = cy - y * scaleY;
            if (px === 40) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // Backward: Fast sigmoid surrogate
        const breathe = 0.5 + 0.5 * Math.sin(time * 2);
        ctx.strokeStyle = `rgba(52, 211, 153, ${0.5 + 0.5 * breathe})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        for (let px = 40; px < w - 40; px++) {
            const x = (px - cx) / scaleX;
            const y = fastSigmoid(x);
            const py = cy - y * scaleY;
            if (px === 40) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Legend
        ctx.fillStyle = '#6366f1';
        ctx.fillRect(40, 40, 20, 4);
        ctx.fillStyle = '#e8e8f0';
        ctx.font = '20px Inter';
        ctx.fillText('Forward: Step Function (actual spikes)', 70, 48);

        ctx.fillStyle = '#34d399';
        ctx.fillRect(40, 68, 20, 4);
        ctx.fillStyle = '#e8e8f0';
        ctx.fillText('Backward: Fast-Sigmoid Surrogate', 70, 76);

        time += 0.016;
        requestAnimationFrame(draw);
    }
    draw();
})();


// ---- 6. Architecture Flow Visualization ----
(function initArch() {
    const container = document.getElementById('arch-canvas');
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a12);
    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 18);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Architecture blocks
    const blocks = [
        { label: 'Input', color: 0x6366f1, x: -12, type: 'input' },
        { label: 'Linear', color: 0x6366f1, x: -9, type: 'linear' },
        { label: 'VSN', color: 0x34d399, x: -6, type: 'vsn' },
        { label: 'GNN', color: 0x8b5cf6, x: -3, type: 'gnn' },
        { label: 'Act', color: 0xfbbf24, x: 0, type: 'act' },
        { label: 'GNN', color: 0x8b5cf6, x: 3, type: 'gnn' },
        { label: 'VSN', color: 0x34d399, x: 6, type: 'vsn' },
        { label: 'Pool', color: 0x22d3ee, x: 9, type: 'pool' },
        { label: 'Output', color: 0xf87171, x: 12, type: 'output' }
    ];

    const blockMeshes = [];
    blocks.forEach((block, i) => {
        const isVSN = block.type === 'vsn';
        const geo = isVSN
            ? new THREE.OctahedronGeometry(1, 0)
            : new THREE.BoxGeometry(1.8, 1.2, 1.2, 1, 1, 1);
        const mat = new THREE.MeshBasicMaterial({
            color: block.color,
            transparent: true,
            opacity: 0.7,
            wireframe: false
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.x = block.x;
        mesh.userData = block;
        scene.add(mesh);
        blockMeshes.push(mesh);

        // Wireframe overlay
        const wireMat = new THREE.MeshBasicMaterial({
            color: block.color,
            transparent: true,
            opacity: 0.3,
            wireframe: true
        });
        const wireMesh = new THREE.Mesh(geo, wireMat);
        wireMesh.position.x = block.x;
        scene.add(wireMesh);
    });

    // Connection lines
    for (let i = 0; i < blocks.length - 1; i++) {
        const mat = new THREE.LineBasicMaterial({ color: 0x444466, transparent: true, opacity: 0.5 });
        const geo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(blocks[i].x + 1, 0, 0),
            new THREE.Vector3(blocks[i + 1].x - 1, 0, 0)
        ]);
        scene.add(new THREE.Line(geo, mat));
    }

    // Data flow particles
    const particleCount = 50;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
        particlePositions[i * 3] = -14 + Math.random() * 28;
        particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
        particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
        particleColors[i * 3] = 0.4; particleColors[i * 3 + 1] = 0.8; particleColors[i * 3 + 2] = 0.6;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
    const particleMat = new THREE.PointsMaterial({
        size: 0.15,
        vertexColors: true,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    let time = 0;

    function animate() {
        requestAnimationFrame(animate);
        time += 0.016;

        blockMeshes.forEach((mesh, i) => {
            mesh.rotation.y = time * 0.5 + i * 0.3;
            if (mesh.userData.type === 'vsn') {
                mesh.rotation.x = time * 0.7;
                mesh.scale.setScalar(1 + 0.15 * Math.sin(time * 3 + i));
            }
        });

        // Move particles
        for (let i = 0; i < particleCount; i++) {
            particlePositions[i * 3] += 0.03;
            if (particlePositions[i * 3] > 14) {
                particlePositions[i * 3] = -14;

                // Some particles get "suppressed" (sparse communication)
                if (Math.random() < 0.4) {
                    particleColors[i * 3] = 0.15;
                    particleColors[i * 3 + 1] = 0.15;
                    particleColors[i * 3 + 2] = 0.15;
                } else {
                    particleColors[i * 3] = 0.2 + Math.random() * 0.2;
                    particleColors[i * 3 + 1] = 0.7 + Math.random() * 0.3;
                    particleColors[i * 3 + 2] = 0.4 + Math.random() * 0.3;
                }
            }
            particlePositions[i * 3 + 1] = Math.sin(time * 2 + particlePositions[i * 3] * 0.5) * 0.3;
        }
        particleGeo.attributes.position.needsUpdate = true;
        particleGeo.attributes.color.needsUpdate = true;

        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
})();


// ---- 7. Example 1: Polycrystal Grain Structure ----
(function initExample1() {
    const container = document.getElementById('example1-canvas');
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x08080f);
    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 12);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enableZoom = false;

    // Generate grain nodes (Voronoi-like)
    const grainCount = 30;
    const grains = [];
    const grainGeo = new THREE.DodecahedronGeometry(0.4, 0);

    for (let i = 0; i < grainCount; i++) {
        const hue = 0.55 + Math.random() * 0.25;
        const mat = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(hue, 0.6, 0.5),
            transparent: true,
            opacity: 0.8
        });
        const mesh = new THREE.Mesh(grainGeo, mat);
        mesh.position.set(
            (Math.random() - 0.5) * 8,
            (Math.random() - 0.5) * 8,
            (Math.random() - 0.5) * 4
        );
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
        scene.add(mesh);
        grains.push(mesh);
    }

    // Grain boundaries (edges between close grains)
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x6366f1, transparent: true, opacity: 0.2 });
    for (let i = 0; i < grainCount; i++) {
        for (let j = i + 1; j < grainCount; j++) {
            if (grains[i].position.distanceTo(grains[j].position) < 3) {
                const geo = new THREE.BufferGeometry().setFromPoints([
                    grains[i].position.clone(),
                    grains[j].position.clone()
                ]);
                scene.add(new THREE.Line(geo, edgeMat));
            }
        }
    }

    let time = 0;
    function animate() {
        requestAnimationFrame(animate);
        time += 0.005;
        controls.update();
        grains.forEach((g, i) => {
            g.rotation.y += 0.003;
            g.scale.setScalar(0.8 + 0.2 * Math.sin(time * 2 + i));
        });
        renderer.render(scene, camera);
    }
    animate();
})();


// ---- 8. Example 2: Magnetostriction Crystal ----
function initExample2() {
    const container = document.getElementById('example2-canvas');
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x08080f);
    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 12);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enableZoom = false;

    // 3D polycrystalline grains
    const grainCount = 20;
    const grains = [];
    for (let i = 0; i < grainCount; i++) {
        const size = 0.3 + Math.random() * 0.4;
        const geo = new THREE.IcosahedronGeometry(size, 0);
        const hue = 0.08 + Math.random() * 0.08; // warm tones for Terfenol
        const mat = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(hue, 0.7, 0.55),
            transparent: true,
            opacity: 0.75,
            wireframe: Math.random() > 0.5
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(
            (Math.random() - 0.5) * 7,
            (Math.random() - 0.5) * 7,
            (Math.random() - 0.5) * 5
        );
        scene.add(mesh);
        grains.push(mesh);
    }

    // Magnetic field arrow
    const arrowDir = new THREE.Vector3(1, 0, 0);
    const arrowOrigin = new THREE.Vector3(-5, 0, 0);
    const arrow = new THREE.ArrowHelper(arrowDir, arrowOrigin, 3, 0x22d3ee, 0.5, 0.3);
    scene.add(arrow);

    // Edges
    const edgeMat = new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.15 });
    for (let i = 0; i < grainCount; i++) {
        for (let j = i + 1; j < grainCount; j++) {
            if (grains[i].position.distanceTo(grains[j].position) < 3.5) {
                const geo = new THREE.BufferGeometry().setFromPoints([
                    grains[i].position.clone(), grains[j].position.clone()
                ]);
                scene.add(new THREE.Line(geo, edgeMat));
            }
        }
    }

    let time = 0;
    function animate() {
        requestAnimationFrame(animate);
        time += 0.005;
        controls.update();

        // Animate magnetic field direction rotation
        const angle = Math.sin(time) * 0.3;
        arrow.setDirection(new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0).normalize());

        grains.forEach((g, i) => {
            g.rotation.y += 0.002;
            // Magnetostrictive deformation
            const stretch = 1 + 0.1 * Math.sin(time * 3 + i);
            g.scale.set(stretch, 1 / Math.sqrt(stretch), 1 / Math.sqrt(stretch));
        });

        renderer.render(scene, camera);
    }
    animate();
}


// ---- 9. Example 3: Graphene Membrane ----
function initExample3() {
    const container = document.getElementById('example3-canvas');
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x08080f);
    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 3, 10);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enableZoom = false;

    // Graphene hexagonal lattice
    const atoms = [];
    const atomGeo = new THREE.SphereGeometry(0.08, 12, 12);
    const rows = 14;
    const cols = 20;
    const spacing = 0.5;

    // Create defects (holes)
    const defects = new Set();
    for (let d = 0; d < 8; d++) {
        const dr = Math.floor(Math.random() * rows);
        const dc = Math.floor(Math.random() * cols);
        defects.add(`${dr}-${dc}`);
        defects.add(`${dr + 1}-${dc}`);
        defects.add(`${dr}-${dc + 1}`);
    }

    const atomGrid = {};

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (defects.has(`${r}-${c}`)) continue;

            const x = c * spacing * 1.5 - (cols * spacing * 1.5) / 2;
            const y = 0;
            const z = r * spacing * Math.sqrt(3) + (c % 2 ? spacing * Math.sqrt(3) / 2 : 0) - (rows * spacing * Math.sqrt(3)) / 2;

            // Stress color based on proximity to defects
            let minDefectDist = 999;
            defects.forEach(d => {
                const [dr, dc] = d.split('-').map(Number);
                const dx = c - dc;
                const dz = r - dr;
                minDefectDist = Math.min(minDefectDist, Math.sqrt(dx * dx + dz * dz));
            });
            const stress = Math.max(0, 1 - minDefectDist / 4);
            const color = new THREE.Color().setHSL(0.55 - stress * 0.55, 0.8, 0.4 + stress * 0.3);

            const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
            const mesh = new THREE.Mesh(atomGeo, mat);
            mesh.position.set(x, y, z);
            mesh.userData = { stress, baseY: y, r, c };
            scene.add(mesh);
            atoms.push(mesh);
            atomGrid[`${r}-${c}`] = mesh;
        }
    }

    // Bonds
    const bondMat = new THREE.LineBasicMaterial({ color: 0x444466, transparent: true, opacity: 0.3 });
    atoms.forEach(atom => {
        const { r, c } = atom.userData;
        const neighbors = [[r, c + 1], [r, c - 1], [r + 1, c], [r - 1, c], [r + 1, c - 1], [r - 1, c + 1]];
        neighbors.forEach(([nr, nc]) => {
            const key = `${nr}-${nc}`;
            if (atomGrid[key]) {
                const geo = new THREE.BufferGeometry().setFromPoints([
                    atom.position.clone(), atomGrid[key].position.clone()
                ]);
                scene.add(new THREE.Line(geo, bondMat));
            }
        });
    });

    let time = 0;
    function animate() {
        requestAnimationFrame(animate);
        time += 0.008;
        controls.update();

        // Simulate strain wave
        atoms.forEach(atom => {
            const wave = Math.sin(time * 2 + atom.position.x * 0.5) * 0.1 * atom.userData.stress;
            atom.position.y = atom.userData.baseY + wave;
        });

        renderer.render(scene, camera);
    }
    animate();
}


// ---- 10. Sparsity Visualization ----
(function initSparsity() {
    const container = document.getElementById('sparsity-canvas');
    if (!container) return;

    const canvas = document.createElement('canvas');
    canvas.width = container.clientWidth * 2;
    canvas.height = 600;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const w = canvas.width;
    const h = canvas.height;
    let time = 0;

    const examples = [
        { name: 'Ex.1: Titanium', activity: 0.37, color: '#6366f1', x: w * 0.2 },
        { name: 'Ex.2: Terfenol-D', activity: 0.18, color: '#8b5cf6', x: w * 0.5 },
        { name: 'Ex.3: Graphene', activity: 0.59, color: '#a78bfa', x: w * 0.8 }
    ];

    function draw() {
        ctx.clearRect(0, 0, w, h);

        const gridSize = 12;
        const cellSize = 22;
        const gridW = gridSize * cellSize;
        const gridH = gridSize * cellSize;

        examples.forEach((ex, ei) => {
            const startX = ex.x - gridW / 2;
            const startY = 80;

            // Title
            ctx.fillStyle = ex.color;
            ctx.font = 'bold 22px Inter';
            ctx.textAlign = 'center';
            ctx.fillText(ex.name, ex.x, 50);

            // Activity text
            ctx.fillStyle = '#34d399';
            ctx.font = '18px JetBrains Mono';
            ctx.fillText(`Activity: ${Math.round(ex.activity * 100)}%`, ex.x, 70);

            // Grid of neurons
            for (let r = 0; r < gridSize; r++) {
                for (let c = 0; c < gridSize; c++) {
                    const x = startX + c * cellSize;
                    const y = startY + r * cellSize;
                    const idx = r * gridSize + c;
                    const threshold = ex.activity + 0.1 * Math.sin(time * 2 + idx * 0.3);
                    const active = (Math.sin(idx * 1.7 + time * 0.5) * 0.5 + 0.5) < threshold;

                    ctx.fillStyle = active ? ex.color : 'rgba(255,255,255,0.04)';
                    ctx.globalAlpha = active ? (0.6 + 0.3 * Math.sin(time * 3 + idx)) : 0.5;
                    ctx.beginPath();
                    ctx.roundRect(x + 2, y + 2, cellSize - 4, cellSize - 4, 4);
                    ctx.fill();
                    ctx.globalAlpha = 1;
                }
            }

            // Sparsity bar
            const barY = startY + gridH + 20;
            const barW = gridW;
            const barH = 14;

            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            ctx.beginPath();
            ctx.roundRect(startX, barY, barW, barH, 7);
            ctx.fill();

            const activeW = barW * ex.activity;
            ctx.fillStyle = ex.color;
            ctx.globalAlpha = 0.7;
            ctx.beginPath();
            ctx.roundRect(startX, barY, activeW, barH, 7);
            ctx.fill();
            ctx.globalAlpha = 1;

            // Sparsity label
            ctx.fillStyle = '#34d399';
            ctx.font = '18px JetBrains Mono';
            ctx.fillText(`${Math.round((1 - ex.activity) * 100)}% sparse`, ex.x, barY + barH + 25);
        });

        // Legend
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '18px Inter';
        ctx.fillText('■ Active neurons    □ Suppressed (sparse) neurons    — Lower activity = more energy savings', w / 2, h - 30);

        time += 0.016;
        requestAnimationFrame(draw);
    }
    draw();
})();
