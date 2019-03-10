import { Scene, Color } from 'three';
import PCDLoader from 'js/loader/PCDLoader';
// import cube from 'js/object/cube';

const scene = new Scene();
scene.background = new Color(0x000000);

// scene.add(cube);

scene.animateSceneElements = function () {
    // cube.rotation.x += 0.01;
    // cube.rotation.y += 0.01;
};

// instantiate a loader
const loader = new PCDLoader();

// load a resource
loader.load(
    // resource URL
    '../static/output.pcd',
    // called when the resource is loaded
    (mesh) => {
        scene.add(mesh);
    },
    // called when loading is in progresses
    (xhr) => {
        console.log(`${(xhr.loaded / xhr.total * 100)}% loaded`);
    },
    // called when loading has errors
    (error) => {
        console.log(`An error happened: ${error}`);
    },
);

export default scene;
