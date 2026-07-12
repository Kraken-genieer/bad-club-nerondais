/*
 * <bcn-racket> — Visionneuse 3D de la raquette du club (Racket.obj).
 * Rendu Three.js en wireframe néon cyan sur fond transparent,
 * rotation continue douce + réaction au survol de la souris.
 * Charge three.js en module ESM depuis un CDN ; si le chargement
 * échoue (hors-ligne), l'élément reste simplement vide.
 */
(function () {
  class BCNRacket extends HTMLElement {
    connectedCallback() {
      if (this._started) return;
      this._started = true;
      this.style.display = 'block';
      this.style.width = '100%';
      this.style.height = '100%';
      this._init().catch((e) => console.warn('bcn-racket:', e));
    }

    disconnectedCallback() {
      cancelAnimationFrame(this._raf);
      if (this._ro) this._ro.disconnect();
      this._started = false;
    }

    async _init() {
      // esm.sh réécrit les spécificateurs nus — même instance de three partout
      const THREE = await import('https://esm.sh/three@0.160.0');

      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;';
      this.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 2000);

      const url = this.getAttribute('src') || 'assets/racket.obj';
      const isGlb = /\.glb$|\.gltf$/i.test(url);
      let obj;
      if (isGlb) {
        const { GLTFLoader } = await import('https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js');
        const gltf = await new GLTFLoader().loadAsync(url);
        obj = gltf.scene; // matériaux et textures embarqués dans le .glb
      } else {
        const { OBJLoader } = await import('https://esm.sh/three@0.160.0/examples/jsm/loaders/OBJLoader.js');
        obj = await new OBJLoader().loadAsync(url);
      }

      // recentre + normalise l'échelle
      const box = new THREE.Box3().setFromObject(obj);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      obj.position.sub(center);

      const group = new THREE.Group();
      group.add(obj);
      scene.add(group);

      // matériaux : le .glb embarque les siens ; pour l'.obj, textures fournies
      if (!isGlb) {
      const texLoader = new THREE.TextureLoader();
      const load = (u) => { const t = texLoader.load(u); t.colorSpace = THREE.SRGBColorSpace; t.flipY = true; return t; };
      const texVerde = load('assets/uv-verde.jpg');       // cadre (UV map verte)
      const texTube = load('assets/tube-green.jpg');      // tige / capuchon
      const texHandle = load('assets/handle-texture.jpg'); // grip sombre
      const matFrame = new THREE.MeshStandardMaterial({ map: texVerde, roughness: 0.4, metalness: 0.25 });
      const matTube = new THREE.MeshStandardMaterial({ map: texTube, roughness: 0.4, metalness: 0.25 });
      const matHandle = new THREE.MeshStandardMaterial({ map: texHandle, roughness: 0.85, metalness: 0.0 });
      const matStrings = new THREE.MeshStandardMaterial({ color: 0xf2f5f8, roughness: 0.55, metalness: 0.05 });
      const matGrommets = new THREE.MeshStandardMaterial({ color: 0x10241a, roughness: 0.5, metalness: 0.1 });
      obj.traverse((child) => {
        if (!child.isMesh) return;
        const name = (child.material && child.material.name) || '';
        if (name.indexOf('1SG') !== -1) child.material = matStrings;        // cordage
        else if (name.indexOf('2SG') !== -1) child.material = matGrommets;  // œillets
        else if (name.indexOf('4SG') !== -1) child.material = matHandle;    // grip
        else if (name.indexOf('6SG') !== -1) child.material = matTube;      // capuchon
        else if (name.indexOf('10SG') !== -1) child.material = matTube;     // embout logo
        else child.material = matFrame;                                      // cadre (3SG)
      });
      }
      scene.add(new THREE.AmbientLight(0xd8e6f2, 1.1));
      const key = new THREE.DirectionalLight(0xffffff, 2.2);
      key.position.set(2, 3, 4);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x29abe2, 1.1);
      rim.position.set(-3, -1, -2);
      scene.add(rim);
      const warm = new THREE.DirectionalLight(0xf58220, 0.5);
      warm.position.set(1, -2, 1);
      scene.add(warm);

      camera.position.set(0, 0, maxDim * (isGlb ? 2.4 : 1.7));
      camera.lookAt(0, 0, 0);

      // orientation de présentation : tête en haut, légère inclinaison
      group.rotation.z = isGlb ? 0 : 0.5;
      group.rotation.x = 0.15;
      // objets à symétrie de révolution (volant) : on incline le modèle
      // à l'intérieur du groupe, sinon la rotation Y semble immobile
      if (isGlb) obj.rotation.z = 0.55;

      const resize = () => {
        const w = this.clientWidth || 300, h = this.clientHeight || 300;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      this._ro = new ResizeObserver(resize);
      this._ro.observe(this);
      resize();

      // parallax souris léger + manipulation directe (glisser pour tourner)
      let tx = 0, ty = 0, px = 0, py = 0;
      let dragging = false, lastX = 0, lastY = 0;
      let userY = 0, userX = 0;        // rotation imposée par l'utilisateur
      let autoY = 0;                    // rotation automatique
      let idleAt = 0;                   // reprise auto après inactivité
      renderer.domElement.style.cursor = 'grab';
      renderer.domElement.style.touchAction = 'none';
      this.addEventListener('pointerdown', (e) => {
        dragging = true;
        lastX = e.clientX; lastY = e.clientY;
        renderer.domElement.style.cursor = 'grabbing';
        this.setPointerCapture(e.pointerId);
        e.preventDefault();
      });
      this.addEventListener('pointermove', (e) => {
        if (dragging) {
          userY += (e.clientX - lastX) * 0.012;
          userX += (e.clientY - lastY) * 0.010;
          userX = Math.max(-1.4, Math.min(1.4, userX));
          lastX = e.clientX; lastY = e.clientY;
          idleAt = performance.now() + 2500;
          return;
        }
        const r = this.getBoundingClientRect();
        tx = ((e.clientX - r.left) / r.width - 0.5) * 0.6;
        ty = ((e.clientY - r.top) / r.height - 0.5) * 0.4;
      });
      const endDrag = () => { dragging = false; renderer.domElement.style.cursor = 'grab'; };
      this.addEventListener('pointerup', endDrag);
      this.addEventListener('pointercancel', endDrag);
      this.addEventListener('pointerleave', () => { tx = 0; ty = 0; endDrag(); });

      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      let prevT = 0;
      const loop = (t) => {
        this._raf = requestAnimationFrame(loop);
        const dt = prevT ? t - prevT : 16;
        prevT = t;
        px += (tx - px) * 0.05;
        py += (ty - py) * 0.05;
        // rotation auto : suspendue pendant/juste après la manipulation
        if (!reduced && !dragging && t > idleAt) autoY += dt * 0.00016;
        group.rotation.y = autoY + userY + px;
        group.rotation.x = 0.15 + userX + py;
        renderer.render(scene, camera);
      };
      this._raf = requestAnimationFrame(loop);
    }
  }

  if (!customElements.get('bcn-racket')) customElements.define('bcn-racket', BCNRacket);
})();
