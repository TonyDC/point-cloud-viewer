import './style.css';

import scene from 'js/scene';
import camera from 'js/camera';
import renderer from 'js/renderer';
import TrackballControls from 'js/controller/TrackballControls';

// Set camera position
camera.position.z = 50;
camera.position.x = 100;

camera.lookAt(scene.position);

const controls = new TrackballControls(camera);

function animate() {
    requestAnimationFrame(animate);
    scene.animateSceneElements();
    renderer.render(scene, camera);
    controls.update();
}

// To actually be able to display anything with three.js, we need three things:
// scene, camera and renderer, so that we can render the scene with camera.

document.body.appendChild(renderer.domElement);

animate();
