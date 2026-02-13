import * as THREE from 'three'
import Experience from '@experience/Experience.js'
import DebugHelpers from "../Objects/DebugHelpers.js";
import Time from "@experience/Utils/Time.js";
import EventEmitter from '@experience/Utils/EventEmitter.js';
import Debug from '@experience/Utils/Debug.js';

import Camera from './Camera.js'
import Input from "@experience/Utils/Input.js";
import Environment from "./Environment.js";

import BlackHole from "@experience/Worlds/MainWorld/BlackHole.js";
import Galaxy from "@experience/Worlds/MainWorld/Galaxy.js";
import SolarSystem from "@experience/Worlds/MainWorld/SolarSystem.js";

import { color, uniform } from "three/tsl";

export default class MainWorld extends EventEmitter {
    experience = Experience.getInstance()
    time = this.experience.time
    debug = this.experience.debug
    state = this.experience.state
    renderer = this.experience.renderer.instance
    scene = new THREE.Scene()
    camera = new Camera( { world: this } )
    input = new Input( { camera: this.camera.instance } )
    resources = this.experience.resources
    html = this.experience.html
    sound = this.experience.sound

    uniforms = this.state.uniforms.mainScene

    enabled = true

    constructor() {
        super();

        this._setDebug()

        this.init()

        this.scene.add( this.camera.instance )
    }

    init() {
        //this.example = new ExampleClass( { world: this } )
        this.blackHole = new BlackHole( { world: this } )
        this.galaxy = new Galaxy( { world: this } )
        this.solarSystem = new SolarSystem( { world: this } )

        this.environment = new Environment( { world: this } )

        this.debugHelpers = new DebugHelpers( { world: this } )

        this._setupUIControls()
    }

    _setupUIControls() {
        this.isSolarSystemView = false
        this.previousSunPosition = new THREE.Vector3()

        // 1) 뷰 전환 버튼
        const btnView = document.getElementById('viewToggle')
        if (btnView) {
            btnView.addEventListener('click', () => this._toggleView())
        }



        // 3) 은하 파티클 토글
        const btnParticle = document.getElementById('particleToggle')
        if (btnParticle) {
            btnParticle.addEventListener('click', () => {
                const galaxy = this.galaxy
                const currentVisible = galaxy.galaxyPoints?.visible
                    ?? galaxy.nebulaGroup?.visible
                    ?? galaxy.bulgeGroup?.visible
                    ?? galaxy.dustGroup?.visible
                    ?? true

                const nextVisible = !currentVisible

                if (galaxy.galaxyPoints) galaxy.galaxyPoints.visible = nextVisible
                if (galaxy.nebulaGroup) galaxy.nebulaGroup.visible = nextVisible
                if (galaxy.bulgeGroup) galaxy.bulgeGroup.visible = nextVisible
                if (galaxy.dustGroup) galaxy.dustGroup.visible = nextVisible

                const visible = nextVisible
                btnParticle.innerText = visible ? 'Hide Galaxy Particles' : 'Show Galaxy Particles'
            })
        }
    }

    _toggleView() {
        this.isSolarSystemView = !this.isSolarSystemView
        const btn = document.getElementById('viewToggle')
        const cam = this.camera

        if (this.isSolarSystemView) {
            btn.innerText = 'Switch to Galactic View'
            const sun = this.solarSystem?.sun
            if (sun) {
                const offset = new THREE.Vector3(0, 100, 200)
                cam.instance.position.copy(sun.position).add(offset)
                cam.controls.target.copy(sun.position)
                cam.controls.maxDistance = 5000
            }
        } else {
            btn.innerText = 'Switch to Solar System View'
            cam.instance.position.copy(cam.defaultCameraPosition)
            cam.controls.target.set(0, 0, 0)
            cam.controls.maxDistance = 2000
        }
    }

    animationPipeline() {
        this.example?.animationPipeline()
        this.blackHole?.animationPipeline()
    }

    postInit() {
        this.example?.postInit()
        this.blackHole?.postInit()
    }

    resize() {
        this.example?.resize()
        this.blackHole?.resize()

        this.camera?.resize()
    }

    update( deltaTime ) {
        if ( !this.enabled ) return

        this.debugHelpers?.update( deltaTime )
        this.blackHole?.update( deltaTime )
        this.galaxy?.update( deltaTime )

        // 태양 이전 위치 저장
        const sun = this.solarSystem?.sun
        if (sun && this.previousSunPosition) {
            this.previousSunPosition.copy(sun.position)
        }

        this.solarSystem?.update( deltaTime )

        // 태양계 뷰 추적
        if (this.isSolarSystemView && sun) {
            const delta = new THREE.Vector3().subVectors(sun.position, this.previousSunPosition)
            this.camera.instance.position.add(delta)
            this.camera.controls.target.copy(sun.position)
        }

        this.camera?.update()
    }

    postUpdate( deltaTime ) {

    }

    _setDebug() {
        if ( !this.debug.active ) return

        this.debugFolder = this.debug.panel.addFolder( {
            title: 'Main World', expanded: true
        } )

        const postProcessFolder = this.debugFolder.addFolder( {
            title: 'PostProcess',
            expanded: false
        } )

        // Bloom Pass Preload
        postProcessFolder.addBinding( this.state.uniforms.mainScene.bloomPass.strength, 'value', {
            min: 0, max: 5, step: 0.001, label: 'Strength'
        } )

        postProcessFolder.addBinding( this.state.uniforms.mainScene.bloomPass.radius, 'value', {
            min: -2, max: 1, step: 0.001, label: 'Radius'
        } )

        postProcessFolder.addBinding( this.state.uniforms.mainScene.bloomPass.threshold, 'value', {
            min: 0, max: 1, step: 0.001, label: 'Threshold'
        } )



        // this.debugFolder.addBinding( this.uniforms.compositionColor, 'value', {
        //     label: 'Composition Color',
        //     color: { type: 'float' }
        // } ).on( 'change', () => {
        //     this.water.rectLight1.color = this.uniforms.compositionColor.value
        // } )
        //
        // this.debugFolder.addBinding( this.uniforms.emissiveIntensity, 'value', {
        //     label: 'Emission Intensity',
        //     min: 1,
        //     max: 4
        // } )

    }
}
