import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let camara, escenario, renderizador, cronometro, mezclador, modelo, animaciones, animacionActiva, controles, pointerLockControls;
const teclado = {};
const velocidadMovimiento = 100;
const objetosColisionables = [];
const boundingBoxesColisionables = [];
const estadisticas = new Stats();

// Sistema de control
let posicionReal = new THREE.Vector3(0, 0, 0);
let rotacionReal = new THREE.Euler(0, 0, 0, 'YXZ');
let movimientoActivo = false;
let direccionMovimiento = new THREE.Vector3();
let contenedorRaiz = new THREE.Group();

// Sistema de salto
let estaSaltando = false;
let velocidadY = 0;
const gravedad = -500;
const fuerzaSalto = 200;

// Sistema de colisiones mejorado
let radioPersonaje = 10; // VALOR FIJO de 10 para colisiones
let colisionesActivas = true;

// Sistema de audio
let backgroundMusic;
let audioListener;

// Elemento de letrero reminder
let reminderElement;

// Control de rotación de cámara con flechas
let rotacionCamaraFlechasX = 0;
let rotacionCamaraFlechasY = 0;
const velocidadRotacionCamara = 2.0;
const anguloMaximoVertical = Math.PI / 6; // Límite de 30 grados para mirar arriba/abajo

// Control de rotación de cámara con ratón
let rotacionCamaraRatonX = 0;
let rotacionCamaraRatonY = 0;
const sensibilidadRaton = 0.002;
let ratonPresionado = false;

// Sistema de NPC
let npc;
let npcMixer;
let npcAnimaciones = {};
let estadoNPC = 'pose'; // pose -> taunt -> punching -> takingPunch -> assassination
let contadorGolpes = 0;
const rangoCercano = 300; // Radio del círculo de activación (rango medio cercano)
const posicionNPC = new THREE.Vector3(0, 0, -400); // Posición DETRÁS del jugador
let usuarioEnRango = false;
let tiempoFueraGolpe = 0;
const tiempoRegresoTaunt = 3.0; // 3 segundos para regresar a taunt

// Sistema de herramientas
let herramientas = [];

// Configuración de cámara en tercera persona (estilo GTA 5)
const offsetCamara = new THREE.Vector3(0, 150, 300); // Detrás y arriba del personaje
let anguloCamaraHorizontal = 0;
let anguloCamaraVertical = 0;
const suavizadoCamara = 0.1;

iniciarEscenario();
animarEscena();

function crearReminder() {
    reminderElement = document.createElement('div');
    reminderElement.style.position = 'fixed';
    reminderElement.style.top = '0';
    reminderElement.style.left = '0';
    reminderElement.style.width = '100%';
    reminderElement.style.height = '100%';
    reminderElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    reminderElement.style.display = 'flex';
    reminderElement.style.justifyContent = 'center';
    reminderElement.style.alignItems = 'center';
    reminderElement.style.color = '#8B4513'; // Color marrón medieval
    reminderElement.style.fontFamily = "'Times New Roman', 'Palatino Linotype', 'Book Antiqua', Palatino, serif";
    reminderElement.style.fontSize = '24px';
    reminderElement.style.fontWeight = 'bold';
    reminderElement.style.fontStyle = 'italic';
    reminderElement.style.zIndex = '10000';
    reminderElement.style.cursor = 'pointer';
    reminderElement.style.textAlign = 'center';
    reminderElement.style.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.8)';
    reminderElement.style.letterSpacing = '1px';
    reminderElement.textContent = 'Haga clic en la pantalla para iniciar';
    
    // Agregar evento para quitar el reminder al hacer clic
    reminderElement.addEventListener('click', quitarReminder);
    
    document.body.appendChild(reminderElement);
}

function quitarReminder() {
    if (reminderElement) {
        reminderElement.style.display = 'none';
        reminderElement.removeEventListener('click', quitarReminder);
        
        // Iniciar música cuando se quite el reminder
        if (backgroundMusic && !backgroundMusic.isPlaying) {
            backgroundMusic.play();
        }
        
        // Cambiar NPC a VillianTaunt cuando se hace clic en la pantalla
        cambiarNPC('taunt');
        
        // Activar controles de ratón después de quitar el reminder
        activarControlesRaton();
    }
}

function activarControlesRaton() {
    // Eventos para controlar el ratón
    document.addEventListener('mousedown', function(event) {
        if (event.button === 0) { // Botón izquierdo del ratón
            ratonPresionado = true;
        }
    });
    
    document.addEventListener('mouseup', function(event) {
        if (event.button === 0) { // Botón izquierdo del ratón
            ratonPresionado = false;
        }
    });
    
    document.addEventListener('mousemove', function(event) {
        if (ratonPresionado) {
            // Actualizar rotación de cámara con el movimiento del ratón
            rotacionCamaraRatonX = -event.movementX * sensibilidadRaton;
            rotacionCamaraRatonY = -event.movementY * sensibilidadRaton;
        }
    });
    
    // Permitir rotación de cámara incluso cuando el ratón sale del canvas
    document.addEventListener('mouseleave', function() {
        // No hacer nada, mantener el estado actual
    });
    
    document.addEventListener('mouseenter', function() {
        // No hacer nada, mantener el estado actual
    });
}

function iniciarEscenario() {
    const contenedor = document.createElement('div');
    document.body.appendChild(contenedor);

    // Crear el letrero reminder al inicio
    crearReminder();

    // CÁMARA EN TERCERA PERSONA (ESTILO GTA 5)
    camara = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 3000);
    camara.position.copy(offsetCamara);
    camara.screenSpacePanning = false;

    escenario = new THREE.Scene();
    escenario.fog = new THREE.Fog(0xd3d3d3, 50, 2000);

    // ILUMINACIÓN MEJORADA
    const luzHemisferica = new THREE.HemisphereLight(0x87CEEB, 0x8B4513, 1.2);
    luzHemisferica.position.set(0, 500, 0);
    escenario.add(luzHemisferica);

    const luzDireccional = new THREE.DirectionalLight(0xFFFFFF, 1.5);
    luzDireccional.position.set(300, 500, 200);
    luzDireccional.castShadow = true;
    luzDireccional.shadow.camera.top = 500;
    luzDireccional.shadow.camera.bottom = -500;
    luzDireccional.shadow.camera.left = -500;
    luzDireccional.shadow.camera.right = 500;
    escenario.add(luzDireccional);

    const luzAmbiental = new THREE.AmbientLight(0x404040, 0.6);
    escenario.add(luzAmbiental);

    const loader = new THREE.TextureLoader();

    const texturaColor = loader.load('Models/background/textures/Poliigon_GrassPatchyGround_4585_BaseColor.jpg');
    const texturaNormal = loader.load('Models/background/textures/Poliigon_GrassPatchyGround_4585_Normal.jpg'); 
    const texturaRugosidad = loader.load('Models/background/textures/Poliigon_GrassPatchyGround_4585_Roughness.jpg');
    
    [texturaColor, texturaNormal, texturaRugosidad].forEach(tex => {
        if (tex) {
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(8, 8);
        }
    });

    const geometriaSuelo = new THREE.PlaneGeometry(6000, 6000, 256, 256);
    geometriaSuelo.setAttribute('uv2', new THREE.BufferAttribute(geometriaSuelo.attributes.uv.array, 2));

    const materialSuelo = new THREE.MeshStandardMaterial({
        map: texturaColor,
        normalMap: texturaNormal,
        roughnessMap: texturaRugosidad,
        roughness: 0.7,
        metalness: 0.1,
    });

    const suelo = new THREE.Mesh(geometriaSuelo, materialSuelo);
    suelo.rotation.x = -Math.PI / 2;
    suelo.receiveShadow = true;
    suelo.castShadow = true;

    escenario.add(suelo);
    escenario.add(contenedorRaiz);

    pointerLockControls = new PointerLockControls(camara, document.body);
    escenario.add(pointerLockControls.getObject()); 

    // INICIALIZAR SISTEMA DE AUDIO
    inicializarAudio();

    const cargadorFBX = new FBXLoader();

    // Cargar NPC inicial (VillianPose.fbx)
    cargarNPCInicial();

    cargadorFBX.load('Models/fbx/Paladin.fbx', function (objeto) {
        modelo = objeto;
        modelo.scale.set(1, 1, 1);
        
        modelo.position.set(0, 0, 0);
        modelo.rotation.set(0, 0, 0);
        contenedorRaiz.add(modelo);
        
        modelo.traverse(function (child) {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        // Radio fijo de 10 para colisiones
        radioPersonaje = 10;
        console.log(`Radio de colisión del personaje: ${radioPersonaje} (valor fijo)`);

        mezclador = new THREE.AnimationMixer(modelo);
        animaciones = {};

        cargarAnimaciones(cargadorFBX, mezclador, animaciones);
        
        crearObjetosUnicos([
            'Models/fbx/source/Camping.fbx',
            'Models/fbx/source/Medieval_Asset.fbx',
            'Models/fbx/source/weapons.fbx',
            'Models/fbx/source/Wood_house.fbx',
            'Models/fbx/source/Wooden cart.fbx',
            'Models/fbx/source/Trunk.fbx',
        ], escenario, objetosColisionables);

        crearArbolesGLTF(150, escenario);

        window.addEventListener('keydown', manejarTeclaPresionada);
        window.addEventListener('keyup', manejarTeclaSoltada);
    });

    renderizador = new THREE.WebGLRenderer({ antialias: true });
    renderizador.setPixelRatio(window.devicePixelRatio);
    renderizador.setSize(window.innerWidth, window.innerHeight);
    renderizador.shadowMap.enabled = true;
    renderizador.shadowMap.type = THREE.PCFSoftShadowMap;
    contenedor.appendChild(renderizador.domElement);

    // RESTAURAR EL FONDO HDR PERO SIN TEXTURAS REFLECTIVAS
    // Llamada con tu enlace del release
establecerFondoCieloHDR(
    'https://github.com/rspgoo1/vgraf-threejsEscenario3DMEDIEVAL/releases/download/v1.0/background.hdr'
);


    controles = new OrbitControls(camara, renderizador.domElement);
    controles.target.set(0, 100, 0);
    controles.update();
    controles.enabled = false; // Deshabilitar OrbitControls ya que la cámara sigue al jugador

    window.addEventListener('resize', ajustarVentana);

    cronometro = new THREE.Clock();
    contenedor.appendChild(estadisticas.dom);

    const gui = new GUI({ 
        width: 300,
        title: 'Ajustes de Ambiente',
        closeOnTop: true
    });

    gui.domElement.style.position = 'absolute';
    gui.domElement.style.right = '10px';
    gui.domElement.style.top = '10px';

    const carpetaLuz = gui.addFolder('🌞 Iluminación');
    carpetaLuz.add(luzDireccional, 'intensity', 0, 3, 0.1).name('Luz Solar');
    carpetaLuz.add(luzHemisferica, 'intensity', 0, 2, 0.1).name('Luz Ambiente');
    carpetaLuz.add(luzAmbiental, 'intensity', 0, 2, 0.1).name('Luz Global');

    const carpetaNiebla = gui.addFolder('🌫️ Atmósfera');
    carpetaNiebla.add(escenario.fog, 'near', 10, 500, 1).name('Inicio Niebla');
    carpetaNiebla.add(escenario.fog, 'far', 500, 3000, 10).name('Fin Niebla');

    const carpetaColisiones = gui.addFolder('🚷 Colisiones');
    carpetaColisiones.add({ colisiones: colisionesActivas }, 'colisiones').name('Activar Colisiones')
        .onChange(val => colisionesActivas = val);
    // REMOVIDO: Control deslizante para radio del personaje ya que ahora es fijo
    carpetaColisiones.add({ radio: 10 }, 'radio').name('Radio Personaje').disable();

    // CARPETA DE AUDIO
    const carpetaAudio = gui.addFolder('🎵 Audio');
    const audioControls = {
        musica: true,
        volumen: 0.5
    };
    
    carpetaAudio.add(audioControls, 'musica').name('Música ON/OFF')
        .onChange(val => {
            if (backgroundMusic) {
                if (val) {
                    backgroundMusic.play();
                } else {
                    backgroundMusic.pause();
                }
            }
        });
    
    carpetaAudio.add(audioControls, 'volumen', 0, 1, 0.1).name('Volumen')
        .onChange(val => {
            if (backgroundMusic) {
                backgroundMusic.setVolume(val);
            }
        });

    carpetaLuz.open();
    carpetaNiebla.open();
    carpetaColisiones.open();
    carpetaAudio.open();
}

function actualizarCamara() {
    // Calcular la posición de la cámara basada en los ángulos de rotación
    const offsetCalculado = new THREE.Vector3();
    
    // Rotación horizontal (alrededor del eje Y)
    offsetCalculado.x = Math.sin(anguloCamaraHorizontal) * offsetCamara.z;
    offsetCalculado.z = Math.cos(anguloCamaraHorizontal) * offsetCamara.z;
    
    // Rotación vertical (alrededor del eje X)
    offsetCalculado.y = offsetCamara.y + Math.sin(anguloCamaraVertical) * 100;
    
    // Aplicar la posición calculada a la cámara
    const posicionObjetivo = new THREE.Vector3();
    posicionObjetivo.copy(posicionReal).add(offsetCalculado);
    
    // Suavizar el movimiento de la cámara
    camara.position.lerp(posicionObjetivo, suavizadoCamara);
    
    // Hacer que la cámara mire al personaje (ligeramente por encima para ver mejor)
    const objetivoMirar = new THREE.Vector3(posicionReal.x, posicionReal.y + 50, posicionReal.z);
    camara.lookAt(objetivoMirar);
}

function cargarNPCInicial() {
    const cargadorFBX = new FBXLoader();
    
    cargadorFBX.load('Models/fbx/VillianPose.fbx', function (objeto) {
        npc = objeto;
        npc.scale.set(1, 1, 1);
        npc.position.copy(posicionNPC);
        
        npc.traverse(function (child) {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        escenario.add(npc);
        
        // Agregar colisión para el NPC con radio más grande
        const box = new THREE.Box3().setFromObject(npc);
        const centro = new THREE.Vector3();
        box.getCenter(centro);
        const tamaño = box.getSize(new THREE.Vector3());
        const radioNPC = Math.max(tamaño.x, tamaño.z) * 1.2; // Aumentar radio para evitar traspaso
        
        objetosColisionables.push({
            objeto: npc,
            boundingBox: box,
            centro: centro,
            radio: radioNPC
        });
        
        console.log(`NPC VillianPose cargado con radio de colisión: ${radioNPC.toFixed(1)}`);
        
        npcMixer = new THREE.AnimationMixer(npc);
        
        // Cargar animación inicial
        if (npc.animations && npc.animations.length > 0) {
            const accionPose = npcMixer.clipAction(npc.animations[0]);
            accionPose.setLoop(THREE.LoopRepeat);
            accionPose.play();
        }
        
        console.log('NPC VillianPose cargado inicialmente DETRÁS del jugador');
    });
}

function cambiarNPC(nuevoEstado) {
    if (estadoNPC === nuevoEstado) return;
    
    const cargadorFBX = new FBXLoader();
    let rutaModelo = '';
    
    switch(nuevoEstado) {
        case 'pose':
            rutaModelo = 'Models/fbx/VillianPose.fbx';
            break;
        case 'taunt':
            rutaModelo = 'Models/fbx/VillianTaunt.fbx';
            break;
        case 'punching':
            rutaModelo = 'Models/fbx/VillianPunching.fbx';
            break;
        case 'takingPunch':
            rutaModelo = 'Models/fbx/VillianTakingPunch.fbx';
            break;
        case 'assassination':
            rutaModelo = 'Models/fbx/VillianAssassination.fbx';
            break;
    }
    
    if (!rutaModelo) return;
    
    cargadorFBX.load(rutaModelo, function (objeto) {
        // Remover NPC anterior de colisiones
        if (npc) {
            // Remover de objetos colisionables
            const index = objetosColisionables.findIndex(obj => obj.objeto === npc);
            if (index !== -1) {
                objetosColisionables.splice(index, 1);
            }
            escenario.remove(npc);
        }
        
        // Crear nuevo NPC
        npc = objeto;
        npc.scale.set(1, 1, 1);
        npc.position.copy(posicionNPC);
        
        npc.traverse(function (child) {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        escenario.add(npc);
        
        // Agregar colisión para el nuevo NPC con radio más grande
        const box = new THREE.Box3().setFromObject(npc);
        const centro = new THREE.Vector3();
        box.getCenter(centro);
        const tamaño = box.getSize(new THREE.Vector3());
        const radioNPC = Math.max(tamaño.x, tamaño.z) * 1.2; // Aumentar radio para evitar traspaso
        
        objetosColisionables.push({
            objeto: npc,
            boundingBox: box,
            centro: centro,
            radio: radioNPC
        });
        
        npcMixer = new THREE.AnimationMixer(npc);
        
        // Configurar animación según el estado
        if (npc.animations && npc.animations.length > 0) {
            const accion = npcMixer.clipAction(npc.animations[0]);
            
            if (nuevoEstado === 'assassination') {
                accion.setLoop(THREE.LoopOnce);
                accion.clampWhenFinished = true;
            } else {
                accion.setLoop(THREE.LoopRepeat);
            }
            
            accion.play();
        }
        
        estadoNPC = nuevoEstado;
        console.log(`NPC cambiado a: ${nuevoEstado}`);
        
        // Reiniciar temporizador cuando cambia a takingPunch
        if (nuevoEstado === 'takingPunch') {
            tiempoFueraGolpe = 0;
        }
    });
}

function establecerFondoCieloHDR(hdrRuta) {
    const rgbeLoader = new RGBELoader();

    // Fondo temporal mientras carga
    escenario.background = new THREE.Color(0x202020);
    console.log('Cargando HDR desde:', hdrRuta);

    rgbeLoader.load(
        // ✅ Usamos corsproxy.io para hacer que GitHub libere el archivo correctamente
        `https://corsproxy.io/?${encodeURIComponent(hdrRuta)}`,
        function (texture) {
            const pmremGenerator = new THREE.PMREMGenerator(renderizador);
            pmremGenerator.compileEquirectangularShader();

            const envMap = pmremGenerator.fromEquirectangular(texture).texture;
            escenario.background = envMap;

            texture.dispose();
            pmremGenerator.dispose();

            console.log('✅ Fondo HDR cargado correctamente desde GitHub Release');
        },
        undefined,
        function (error) {
            console.error('❌ Error al cargar el fondo HDR:', error);
            escenario.background = new THREE.Color(0x87CEEB); // cielo azul como fallback
        }
    );
}

function verificarRangoNPC() {
    if (!npc) return false;
    
    // Calcular distancia entre el jugador y el NPC
    const distancia = Math.sqrt(
        Math.pow(posicionReal.x - posicionNPC.x, 2) + 
        Math.pow(posicionReal.z - posicionNPC.z, 2)
    );
    
    const estabaEnRango = usuarioEnRango;
    usuarioEnRango = distancia <= rangoCercano;
    
    // Si el usuario acaba de entrar al rango y el NPC está en estado 'taunt'
    if (usuarioEnRango && !estabaEnRango && estadoNPC === 'taunt') {
        cambiarNPC('punching');
        console.log('Usuario entró en rango cercano, NPC cambió a punching');
    }
    
    // Si el usuario sale del rango y el NPC está en punching, regresar a taunt
    if (!usuarioEnRango && estabaEnRango && estadoNPC === 'punching') {
        cambiarNPC('taunt');
        console.log('Usuario salió del rango cercano, NPC regresó a taunt');
    }
    
    return usuarioEnRango;
}

function actualizarTemporizadorNPC(delta) {
    // Solo aplicar temporizador si el NPC está en takingPunch y el usuario está en rango
    if (estadoNPC === 'takingPunch' && usuarioEnRango) {
        tiempoFueraGolpe += delta;
        
        // Si pasan 3 segundos sin golpes, regresar a taunt
        if (tiempoFueraGolpe >= tiempoRegresoTaunt) {
            cambiarNPC('taunt');
            contadorGolpes = 0; // Resetear contador
            console.log('Tiempo agotado, NPC regresó a taunt');
        }
    } else {
        // Resetear temporizador si no está en takingPunch o no está en rango
        tiempoFueraGolpe = 0;
    }
}

function manejarGolpeNPC() {
    // Solo procesar golpes si el usuario está en rango cercano y el NPC está en punching
    if (!usuarioEnRango || estadoNPC !== 'punching') return;
    
    // CAMBIO PRINCIPAL: Con una sola tecla 1, cambiar directamente a assassination
    cambiarNPC('assassination');
    console.log('¡Asesinado con un solo golpe!');
}

function inicializarAudio() {
    // Crear listener de audio y agregarlo a la cámara
    audioListener = new THREE.AudioListener();
    camara.add(audioListener);

    // Crear objeto de audio
    backgroundMusic = new THREE.Audio(audioListener);

    // Cargar el archivo de música
    const audioLoader = new THREE.AudioLoader();
    audioLoader.load(
        'Models/fbx/assets/music/background-music.mp3',
        // onLoad callback
        function(buffer) {
            backgroundMusic.setBuffer(buffer);
            backgroundMusic.setLoop(true);
            backgroundMusic.setVolume(0.5);
            
            // No reproducir automáticamente, esperar a que el usuario haga clic en el reminder
            console.log('Música de fondo cargada, esperando interacción del usuario...');
        },
        // onProgress callback
        function(xhr) {
            console.log('Cargando música: ' + (xhr.loaded / xhr.total * 100) + '% cargado');
        },
        // onError callback
        function(error) {
            console.error('Error al cargar la música de fondo:', error);
        }
    );
}

function cargarAnimaciones(cargador, mezclador, animaciones) {
    cargador.load('Models/fbx/Offensive Idle C.fbx', function (anim) {
        if (anim && anim.animations && anim.animations.length > 0) {
            const accionIdle = mezclador.clipAction(anim.animations[0]);
            accionIdle.setLoop(THREE.LoopRepeat);
            animaciones.idle = accionIdle;
            
            if (!animacionActiva) {
                animacionActiva = accionIdle;
                animacionActiva.play();
            }
        }
    });

    cargador.load('Models/fbx/Walking C.fbx', function (anim) {
        if (anim && anim.animations && anim.animations.length > 0) {
            const accionCaminar = mezclador.clipAction(anim.animations[0]);
            accionCaminar.setLoop(THREE.LoopRepeat);
            animaciones.walk = accionCaminar;
        }
    });

    cargador.load('Models/fbx/Fast C.fbx', function (anim) {
        if (anim && anim.animations && anim.animations.length > 0) {
            const accionRunning = mezclador.clipAction(anim.animations[0]);
            accionRunning.setLoop(THREE.LoopRepeat);
            animaciones.Running = accionRunning;
        }
    });

    cargador.load('Models/fbx/Jumping C.fbx', function (anim) {
        if (anim && anim.animations && anim.animations.length > 0) {
            const accionJump = mezclador.clipAction(anim.animations[0]);
            accionJump.setLoop(THREE.LoopOnce);
            accionJump.clampWhenFinished = true;
            animaciones.Jump = accionJump;
        }
    });

    cargador.load('Models/fbx/Hand.fbx', function (anim) {
        if (anim && anim.animations && anim.animations.length > 0) {
            const accionDancing = mezclador.clipAction(anim.animations[0]);
            accionDancing.setLoop(THREE.LoopOnce);
            accionDancing.clampWhenFinished = true;
            animaciones.Dancing = accionDancing;
        }
    });

    cargador.load('Models/fbx/Shooting.fbx', function (anim) {
        if (anim && anim.animations && anim.animations.length > 0) {
            const accionShooting = mezclador.clipAction(anim.animations[0]);
            accionShooting.setLoop(THREE.LoopOnce);
            accionShooting.clampWhenFinished = true;
            animaciones.Shooting = accionShooting;
        }
    });

    cargador.load('Models/fbx/Threatening.fbx', function (anim) {
        if (anim && anim.animations && anim.animations.length > 0) {
            const accionThreatening = mezclador.clipAction(anim.animations[0]);
            accionThreatening.setLoop(THREE.LoopOnce);
            accionThreatening.clampWhenFinished = true;
            animaciones.Threatening = accionThreatening;
        }
    });
}

function crearObjetosUnicos(rutasModelos, escenario, objetosColisionables) {
    const cargadorFBX = new FBXLoader();
    const loaderTexturas = new THREE.TextureLoader();

    const posiciones = [
        new THREE.Vector3(-800, 0, -200),
        new THREE.Vector3(-100, 0, 800),
        new THREE.Vector3(100, 0, -1000),
        new THREE.Vector3(700, 0, -300),
        new THREE.Vector3(-900, 0, -600)
    ];

    rutasModelos.forEach((ruta, index) => {
        cargadorFBX.load(ruta, function (objeto) {
            objeto.scale.set(1, 1, 1);
            objeto.position.copy(posiciones[index]);

            if (index === 3) objeto.rotation.y = Math.PI / 2;
            if (index === 4) objeto.rotation.y = -Math.PI / 2;

            // APLICAR TEXTURAS ESPECÍFICAS SEGÚN EL OBJETO
            aplicarTexturasObjeto(objeto, ruta, loaderTexturas);

            escenario.add(objeto);
            
            // Crear bounding box más preciso para colisiones
            const box = new THREE.Box3().setFromObject(objeto);
            
            // Calcular radio aproximado del objeto para colisiones esféricas
            const centro = new THREE.Vector3();
            box.getCenter(centro);
            const tamaño = box.getSize(new THREE.Vector3());
            const radioObjeto = Math.max(tamaño.x, tamaño.z) * 0.5;
            
            objetosColisionables.push({
                objeto: objeto,
                boundingBox: box,
                centro: centro,
                radio: radioObjeto
            });
            
            // Si es Medieval_Asset, registrar las herramientas (incluyendo Iron)
            if (ruta.includes('Medieval_Asset.fbx')) {
                registrarHerramientas(objeto);
            }
            
            console.log(`Objeto cargado: ${ruta}, Radio: ${radioObjeto.toFixed(1)}`);
        });
    });
}

function registrarHerramientas(objetoMedieval) {
    // Buscar herramientas dentro del objeto Medieval_Asset (incluyendo Iron)
    objetoMedieval.traverse(function (child) {
        if (child.isMesh) {
            const nombreMaterial = child.material.name.toLowerCase();
            // Incluir Iron y todas las herramientas Tool1-Tool5
            if (nombreMaterial.includes('iron') || nombreMaterial.includes('tool1') || 
                nombreMaterial.includes('tool2') || nombreMaterial.includes('tool3') || 
                nombreMaterial.includes('tool4') || nombreMaterial.includes('tool5')) {
                
                const box = new THREE.Box3().setFromObject(child);
                const centro = new THREE.Vector3();
                box.getCenter(centro);
                
                herramientas.push({
                    objeto: child,
                    posicion: centro,
                    tipo: nombreMaterial
                });
                
                console.log(`Herramienta registrada: ${nombreMaterial} en posición`, centro);
            }
        }
    });
}

function aplicarTexturasObjeto(objeto, ruta, loaderTexturas) {
    objeto.traverse(function (child) {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            
            if (child.material) {
                let materialNuevo;
                
                // Aplicar texturas según el tipo de objeto
                if (ruta.includes('Wood_house.fbx')) {
                    // CASA - SIN TEXTURAS METÁLICAS - ARREGLAR CASA NEGRA
                    const baseColor = loaderTexturas.load('Models/fbx/textures/Wood_house_BaseColor.1001.jpg');
                    const normal = loaderTexturas.load('Models/fbx/textures/Wood_house_Normal.1001.jpg');
                    const roughness = loaderTexturas.load('Models/fbx/textures/Wood_house_Roughness.1001.jpg');
                    
                    materialNuevo = new THREE.MeshStandardMaterial({
                        map: baseColor,
                        normalMap: normal,
                        roughnessMap: roughness,
                        roughness: 0.8,
                        metalness: 0.0 // Sin metalness para la casa
                    });
                    
                } else if (ruta.includes('Camping.fbx')) {
                    // CAMPING - usar texturas de barril
                    const baseColor = loaderTexturas.load('Models/fbx/textures/barrel_basecolor.png');
                    const normal = loaderTexturas.load('Models/fbx/textures/barrel_normal.png');
                    const roughness = loaderTexturas.load('Models/fbx/textures/barrel_roughness.png');
                    const ao = loaderTexturas.load('Models/fbx/textures/barrel_ao.png');
                    
                    materialNuevo = new THREE.MeshStandardMaterial({
                        map: baseColor,
                        normalMap: normal,
                        roughnessMap: roughness,
                        aoMap: ao,
                        roughness: 0.7,
                        metalness: 0.1
                    });
                    
                } else if (ruta.includes('weapons.fbx')) {
                    // WEAPONS - usar texturas de armas
                    const baseColor = loaderTexturas.load('Models/fbx/textures/Weapons_color.png');
                    const normal = loaderTexturas.load('Models/fbx/textures/Weapons_normal.png');
                    const roughness = loaderTexturas.load('Models/fbx/textures/Weapons_roughness.png');
                    const metalness = loaderTexturas.load('Models/fbx/textures/Weapons_metallic.png');
                    
                    materialNuevo = new THREE.MeshStandardMaterial({
                        map: baseColor,
                        normalMap: normal,
                        roughnessMap: roughness,
                        metalnessMap: metalness,
                        roughness: 0.4,
                        metalness: 0.8
                    });
                    
                } else if (ruta.includes('Wooden cart.fbx')) {
                    // WOODEN CART - usar texturas de carreta de madera
                    const baseColor = loaderTexturas.load('Models/fbx/textures/wooden_cart_diffuse.tga');
                    const metalness = loaderTexturas.load('Models/fbx/textures/wooden_cart_metallic.tga');
                    
                    materialNuevo = new THREE.MeshStandardMaterial({
                        map: baseColor,
                        metalnessMap: metalness,
                        roughness: 0.6,
                        metalness: 0.2
                    });
                    
                } else if (ruta.includes('Medieval_Asset.fbx')) {
                    // MEDIEVAL ASSET - aplicar texturas según los nombres de los materiales
                    const nombreMaterial = child.material.name.toLowerCase();
                    
                    if (nombreMaterial.includes('iron')) {
                        // HIERRO
                        const baseColor = loaderTexturas.load('Models/fbx/textures/Iron/Medieval_Asset_M_Iron_BaseColor.png');
                        const normal = loaderTexturas.load('Models/fbx/textures/Iron/Medieval_Asset_M_Iron_Normal.png');
                        const roughness = loaderTexturas.load('Models/fbx/textures/Iron/Medieval_Asset_M_Iron_Roughness.png');
                        const metalness = loaderTexturas.load('Models/fbx/textures/Iron/Medieval_Asset_M_Iron_Metalness.png');
                        
                        materialNuevo = new THREE.MeshStandardMaterial({
                            map: baseColor,
                            normalMap: normal,
                            roughnessMap: roughness,
                            metalnessMap: metalness,
                            roughness: 0.3,
                            metalness: 0.9
                        });
                        
                    } else if (nombreMaterial.includes('tool1')) {
                        // HERRAMIENTA 1
                        const baseColor = loaderTexturas.load('Models/fbx/textures/Tool1/Medieval_Asset_M_Tool1_BaseColor.png');
                        const normal = loaderTexturas.load('Models/fbx/textures/Tool1/Medieval_Asset_M_Tool1_Normal.png');
                        const roughness = loaderTexturas.load('Models/fbx/textures/Tool1/Medieval_Asset_M_Tool1_Roughness.png');
                        
                        materialNuevo = new THREE.MeshStandardMaterial({
                            map: baseColor,
                            normalMap: normal,
                            roughnessMap: roughness,
                            roughness: 0.5,
                            metalness: 0.7
                        });
                        
                    } else if (nombreMaterial.includes('tool2')) {
                        // HERRAMIENTA 2
                        const baseColor = loaderTexturas.load('Models/fbx/textures/Tool2/Medieval_Asset_M_Tool2_BaseColor.png');
                        const normal = loaderTexturas.load('Models/fbx/textures/Tool2/Medieval_Asset_M_Tool2_Normal.png');
                        const roughness = loaderTexturas.load('Models/fbx/textures/Tool2/Medieval_Asset_M_Tool2_Roughness.png');
                        
                        materialNuevo = new THREE.MeshStandardMaterial({
                            map: baseColor,
                            normalMap: normal,
                            roughnessMap: roughness,
                            roughness: 0.5,
                            metalness: 0.7
                        });
                        
                    } else if (nombreMaterial.includes('tool3')) {
                        // HERRAMIENTA 3
                        const baseColor = loaderTexturas.load('Models/fbx/textures/Tool3/Medieval_Asset_M_Tool3_BaseColor.png');
                        const normal = loaderTexturas.load('Models/fbx/textures/Tool3/Medieval_Asset_M_Tool3_Normal.png');
                        const roughness = loaderTexturas.load('Models/fbx/textures/Tool3/Medieval_Asset_M_Tool3_Roughness.png');
                        
                        materialNuevo = new THREE.MeshStandardMaterial({
                            map: baseColor,
                            normalMap: normal,
                            roughnessMap: roughness,
                            roughness: 0.5,
                            metalness: 0.7
                        });
                        
                    } else if (nombreMaterial.includes('tool4')) {
                        // HERRAMIENTA 4
                        const baseColor = loaderTexturas.load('Models/fbx/textures/Tool4/Medieval_Asset_M_Tool4_BaseColor.png');
                        const normal = loaderTexturas.load('Models/fbx/textures/Tool4/Medieval_Asset_M_Tool4_Normal.png');
                        const roughness = loaderTexturas.load('Models/fbx/textures/Tool4/Medieval_Asset_M_Tool4_Roughness.png');
                        
                        materialNuevo = new THREE.MeshStandardMaterial({
                            map: baseColor,
                            normalMap: normal,
                            roughnessMap: roughness,
                            roughness: 0.5,
                            metalness: 0.7
                        });
                        
                    } else if (nombreMaterial.includes('tool5')) {
                        // HERRAMIENTA 5
                        const baseColor = loaderTexturas.load('Models/fbx/textures/Tool5/Medieval_Asset_M_Tool5_BaseColor.png');
                        const normal = loaderTexturas.load('Models/fbx/textures/Tool5/Medieval_Asset_M_Tool5_Normal.png');
                        const roughness = loaderTexturas.load('Models/fbx/textures/Tool5/Medieval_Asset_M_Tool5_Roughness.png');
                        
                        materialNuevo = new THREE.MeshStandardMaterial({
                            map: baseColor,
                            normalMap: normal,
                            roughnessMap: roughness,
                            roughness: 0.5,
                            metalness: 0.7
                        });
                        
                    } else if (nombreMaterial.includes('tool_holder')) {
                        // PORTAHERRAMIENTAS
                        const baseColor = loaderTexturas.load('Models/fbx/textures/Tool_Holder/Medieval_Asset_M_Tool_Holder_BaseColor.png');
                        const normal = loaderTexturas.load('Models/fbx/textures/Tool_Holder/Medieval_Asset_M_Tool_Holder_Normal.png');
                        const roughness = loaderTexturas.load('Models/fbx/textures/Tool_Holder/Medieval_Asset_M_Tool_Holder_Roughness.png');
                        
                        materialNuevo = new THREE.MeshStandardMaterial({
                            map: baseColor,
                            normalMap: normal,
                            roughnessMap: roughness,
                            roughness: 0.6,
                            metalness: 0.3
                        });
                        
                    } else if (nombreMaterial.includes('wood')) {
                        // MADERA
                        const baseColor = loaderTexturas.load('Models/fbx/textures/Wood/Medieval_Asset_M_Wood_BaseColor.png');
                        const normal = loaderTexturas.load('Models/fbx/textures/Wood/Medieval_Asset_M_Wood_Normal.png');
                        const roughness = loaderTexturas.load('Models/fbx/textures/Wood/Medieval_Asset_M_Wood_Roughness.png');
                        
                        materialNuevo = new THREE.MeshStandardMaterial({
                            map: baseColor,
                            normalMap: normal,
                            roughnessMap: roughness,
                            roughness: 0.8,
                            metalness: 0.0
                        });
                        
                    } else if (nombreMaterial.includes('wood_clamp')) {
                        // ABRAZADERA DE MADERA
                        const baseColor = loaderTexturas.load('Models/fbx/textures/Wood_Clamp/Medieval_Asset_M_Wood_Clamp_BaseColor.png');
                        const normal = loaderTexturas.load('Models/fbx/textures/Wood_Clamp/Medieval_Asset_M_Wood_Clamp_Normal.png');
                        const roughness = loaderTexturas.load('Models/fbx/textures/Wood_Clamp/Medieval_Asset_M_Wood_Clamp_Roughness.png');
                        
                        materialNuevo = new THREE.MeshStandardMaterial({
                            map: baseColor,
                            normalMap: normal,
                            roughnessMap: roughness,
                            roughness: 0.7,
                            metalness: 0.1
                        });
                        
                    } else {
                        // MATERIAL POR DEFECTO - usar textura de tronco como antes
                        const texturaTronco = loaderTexturas.load('Models/gltf/textures/tronc-arbre_diffuse.jpeg');
                        texturaTronco.wrapS = THREE.RepeatWrapping;
                        texturaTronco.wrapT = THREE.RepeatWrapping;
                        texturaTronco.repeat.set(2, 2);
                        
                        materialNuevo = new THREE.MeshStandardMaterial({
                            map: texturaTronco,
                            roughness: 0.7,
                            metalness: 0.1
                        });
                    }
                    
                    child.material = materialNuevo;
                    child.material.needsUpdate = true;
                } else {
                    // Para otros objetos que no sean Medieval_Asset, aplicar material básico
                    materialNuevo = new THREE.MeshStandardMaterial({
                        color: 0x888888,
                        roughness: 0.7,
                        metalness: 0.1
                    });
                    child.material = materialNuevo;
                }
            }
        }
    });
}

function crearArbolesGLTF(cantidad, escenario) {
    const loader = new GLTFLoader();

    const zonaProhibida = {
        xMin: -1200, xMax: 1000, zMin: -1200, zMax: 1000
    };

    loader.load('Models/fbx/source/Tree.glb', function(gltf) {
        const arbolBase = gltf.scene;
        arbolBase.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        const escalaBase = 500;
        arbolBase.scale.set(escalaBase, escalaBase, escalaBase);

        const zonasSeguras = [
            { xMin: -3000, xMax: zonaProhibida.xMin, zMin: -3000, zMax: 3000 },
            { xMin: zonaProhibida.xMax, xMax: 3000, zMin: -3000, zMax: 3000 },
            { xMin: zonaProhibida.xMin, xMax: zonaProhibida.xMax, zMin: -3000, zMax: zonaProhibida.zMin },
            { xMin: zonaProhibida.xMin, xMax: zonaProhibida.xMax, zMin: zonaProhibida.zMax, zMax: 3000 }
        ];

        for (let i = 0; i < cantidad; i++) {
            const arbol = arbolBase.clone();
            const zona = zonasSeguras[Math.floor(Math.random() * zonasSeguras.length)];
            const x = Math.random() * (zona.xMax - zona.xMin) + zona.xMin;
            const z = Math.random() * (zona.zMax - zona.zMin) + zona.zMin;

            arbol.position.set(x, 0, z);
            arbol.rotation.y = Math.random() * Math.PI * 2;
            arbol.scale.setScalar(escalaBase * (0.8 + Math.random() * 0.4));
            
            escenario.add(arbol);
            
            // Crear datos de colisión para árboles
            const box = new THREE.Box3().setFromObject(arbol);
            const centro = new THREE.Vector3();
            box.getCenter(centro);
            const tamaño = box.getSize(new THREE.Vector3());
            const radioArbol = Math.max(tamaño.x, tamaño.z) * 0.4; // 40% del tamaño para árboles
            
            objetosColisionables.push({
                objeto: arbol,
                boundingBox: box,
                centro: centro,
                radio: radioArbol
            });
        }
        console.log(`Creados ${cantidad} árboles con colisiones`);
    });
}

function ajustarVentana() {
    camara.aspect = window.innerWidth / window.innerHeight;
    camara.updateProjectionMatrix();
    renderizador.setSize(window.innerWidth, window.innerHeight);
}

function manejarTeclaPresionada(evento) {
    const tecla = evento.key.toLowerCase();
    teclado[tecla] = true;

    // SALTO CON ESPACIO
    if (tecla === ' ' && !estaSaltando) {
        estaSaltando = true;
        velocidadY = fuerzaSalto;
        
        if (animaciones.Jump) {
            cambiarAnimacion(animaciones.Jump);
        }
        evento.preventDefault();
        return;
    }

    // ROTACIÓN DE CÁMARA CON FLECHAS IZQUIERDA Y DERECHA (horizontal)
    if (evento.key === 'ArrowLeft') {
        rotacionCamaraFlechasX = 1; // Rotar cámara a la izquierda
        evento.preventDefault();
        return;
    }
    
    if (evento.key === 'ArrowRight') {
        rotacionCamaraFlechasX = -1; // Rotar cámara a la derecha
        evento.preventDefault();
        return;
    }

    // ROTACIÓN DE CÁMARA CON FLECHAS ARRIBA Y ABAJO (vertical)
    if (evento.key === 'ArrowUp') {
        rotacionCamaraFlechasY = 1; // Mirar hacia arriba
        evento.preventDefault();
        return;
    }
    
    if (evento.key === 'ArrowDown') {
        rotacionCamaraFlechasY = -1; // Mirar hacia abajo
        evento.preventDefault();
        return;
    }

    // Animaciones especiales 1-3 (también activan golpes al NPC si está en rango)
    if (['1', '2', '3'].includes(tecla)) {
        let animacionEspecial = null;
        
        if (tecla === '1' && animaciones.Dancing) {
            animacionEspecial = animaciones.Dancing;
        } else if (tecla === '2' && animaciones.Shooting) {
            animacionEspecial = animaciones.Shooting;
        } else if (tecla === '3' && animaciones.Threatening) {
            animacionEspecial = animaciones.Threatening;
        }
        
        if (animacionEspecial) {
            cambiarAnimacion(animacionEspecial);
            
            // Activar golpe al NPC cuando se presionan las teclas 1, 2 o 3
            // SOLO si el usuario está en rango cercano y el NPC está en punching
            manejarGolpeNPC();
            
            setTimeout(() => {
                if (movimientoActivo) {
                    const animacionMovimiento = teclado['shift'] ? animaciones.Running : animaciones.walk;
                    if (animacionMovimiento) cambiarAnimacion(animacionMovimiento);
                } else if (animaciones.idle) {
                    cambiarAnimacion(animaciones.idle);
                }
            }, 2000);
        }
        return;
    }

    // Movimiento WASD (SOLO PARA MOVIMIENTO DEL PERSONAJE)
    if (['w', 'a', 's', 'd'].includes(tecla)) {
        movimientoActivo = true;
        actualizarDireccionMovimiento();
        
        const animacionMovimiento = teclado['shift'] ? animaciones.Running : animaciones.walk;
        
        if (animacionMovimiento && animacionActiva !== animacionMovimiento && !estaSaltando) {
            cambiarAnimacion(animacionMovimiento);
        }
    }
}

function manejarTeclaSoltada(evento) {
    const tecla = evento.key.toLowerCase();
    teclado[tecla] = false;

    // DETENER ROTACIÓN DE CÁMARA CON FLECHAS
    if (evento.key === 'ArrowLeft' || evento.key === 'ArrowRight') {
        rotacionCamaraFlechasX = 0;
        evento.preventDefault();
        return;
    }

    if (evento.key === 'ArrowUp' || evento.key === 'ArrowDown') {
        rotacionCamaraFlechasY = 0;
        evento.preventDefault();
        return;
    }

    if (['w', 'a', 's', 'd'].includes(tecla)) {
        actualizarDireccionMovimiento();
        
        if (!teclado['w'] && !teclado['a'] && !teclado['s'] && !teclado['d']) {
            movimientoActivo = false;
            
            if (animaciones.idle && animacionActiva !== animaciones.idle && !estaSaltando) {
                cambiarAnimacion(animaciones.idle);
            }
        } else if (movimientoActivo) {
            const animacionMovimiento = teclado['shift'] ? animaciones.Running : animaciones.walk;
            if (animacionMovimiento && animacionActiva !== animacionMovimiento && !estaSaltando) {
                cambiarAnimacion(animacionMovimiento);
            }
        }
    }
}

function actualizarDireccionMovimiento() {
    direccionMovimiento.set(0, 0, 0);
    
    if (teclado['w']) direccionMovimiento.z = -1;
    if (teclado['s']) direccionMovimiento.z = 1;
    if (teclado['a']) direccionMovimiento.x = -1;
    if (teclado['d']) direccionMovimiento.x = 1;
    
    if (direccionMovimiento.length() > 0) {
        direccionMovimiento.normalize();
    }
}

function cambiarAnimacion(nuevaAnimacion) {
    if (animacionActiva !== nuevaAnimacion && nuevaAnimacion) {
        if (animacionActiva) {
            animacionActiva.fadeOut(0.2);
        }
        animacionActiva = nuevaAnimacion;
        animacionActiva.reset().fadeIn(0.2).play();
    }
}

function animarEscena() {
    requestAnimationFrame(animarEscena);

    const delta = cronometro.getDelta();

    // Actualizar animaciones del personaje principal
    if (mezclador) {
        mezclador.update(delta);
    }

    // Actualizar animaciones del NPC
    if (npcMixer) {
        npcMixer.update(delta);
    }

    // Verificar si el usuario está en rango cercano del NPC
    verificarRangoNPC();

    // Actualizar temporizador para regresar a taunt
    actualizarTemporizadorNPC(delta);

    // ACTUALIZAR ROTACIÓN DE CÁMARA CON FLECHAS
    if (rotacionCamaraFlechasX !== 0) {
        anguloCamaraHorizontal += rotacionCamaraFlechasX * velocidadRotacionCamara * delta;
    }
    
    if (rotacionCamaraFlechasY !== 0) {
        anguloCamaraVertical += rotacionCamaraFlechasY * velocidadRotacionCamara * delta * 0.5;
        // Limitar el ángulo vertical
        anguloCamaraVertical = Math.max(-anguloMaximoVertical, Math.min(anguloMaximoVertical, anguloCamaraVertical));
    }

    // ACTUALIZAR ROTACIÓN DE CÁMARA CON RATÓN
    if (rotacionCamaraRatonX !== 0 || rotacionCamaraRatonY !== 0) {
        anguloCamaraHorizontal += rotacionCamaraRatonX;
        anguloCamaraVertical += rotacionCamaraRatonY;
        
        // Limitar el ángulo vertical también para el ratón
        anguloCamaraVertical = Math.max(-anguloMaximoVertical, Math.min(anguloMaximoVertical, anguloCamaraVertical));
        
        // Resetear valores del ratón para el siguiente frame
        rotacionCamaraRatonX = 0;
        rotacionCamaraRatonY = 0;
    }

    // ACTUALIZAR POSICIÓN DE LA CÁMARA PARA QUE SIGA AL JUGADOR (ESTILO GTA 5)
    actualizarCamara();

    // FÍSICA DE SALTO
    if (estaSaltando) {
        velocidadY += gravedad * delta;
        posicionReal.y += velocidadY * delta;
        
        if (posicionReal.y <= 0) {
            posicionReal.y = 0;
            velocidadY = 0;
            estaSaltando = false;
            
            if (movimientoActivo) {
                const animacionMovimiento = teclado['shift'] ? animaciones.Running : animaciones.walk;
                if (animacionMovimiento) {
                    cambiarAnimacion(animacionMovimiento);
                }
            } else if (animaciones.idle) {
                cambiarAnimacion(animaciones.idle);
            }
        }
    }

    // MOVIMIENTO INDEPENDIENTE CON COLISIONES MEJORADAS
    if (movimientoActivo) {
        const velocidadActual = teclado['shift'] ? velocidadMovimiento * 2.0 : velocidadMovimiento;
        const distancia = velocidadActual * delta;

        const vectorMovimiento = direccionMovimiento.clone().multiplyScalar(distancia);
        
        // El movimiento ahora es independiente de la rotación de la cámara
        // El personaje se mueve en la dirección en la que está mirando
        const direccion = vectorMovimiento.clone();
        direccion.applyAxisAngle(new THREE.Vector3(0, 1, 0), anguloCamaraHorizontal);
        direccion.y = 0;

        const nuevaPosicion = posicionReal.clone().add(direccion);

        if (direccion.length() > 0.001) {
            const angulo = Math.atan2(direccion.x, direccion.z);
            rotacionReal.y = angulo;
        }

        // VERIFICAR COLISIONES MEJORADO
        if (colisionesActivas && verificarColisionMejorada(nuevaPosicion)) {
            // Si hay colisión, intentar movimiento en X y Z por separado
            const nuevaPosicionX = new THREE.Vector3(nuevaPosicion.x, 0, posicionReal.z);
            const nuevaPosicionZ = new THREE.Vector3(posicionReal.x, 0, nuevaPosicion.z);
            
            if (!verificarColisionMejorada(nuevaPosicionX)) {
                posicionReal.x = nuevaPosicion.x;
            }
            if (!verificarColisionMejorada(nuevaPosicionZ)) {
                posicionReal.z = nuevaPosicion.z;
            }
        } else {
            // Sin colisión, mover normalmente
            posicionReal.x = nuevaPosicion.x;
            posicionReal.z = nuevaPosicion.z;
        }

        // Ajustar velocidad de animación para running
        if (animacionActiva === animaciones.Running || animacionActiva === animaciones.walk) {
            animacionActiva.timeScale = teclado['shift'] ? 1.5 : 1.0;
        }
    }

    contenedorRaiz.position.copy(posicionReal);
    contenedorRaiz.rotation.copy(rotacionReal);

    renderizador.render(escenario, camara);
    estadisticas.update();
}

// SISTEMA DE COLISIONES MEJORADO
function verificarColisionMejorada(nuevaPosicion) {
    if (!colisionesActivas) return false;
    
    for (let i = 0; i < objetosColisionables.length; i++) {
        const objetoColision = objetosColisionables[i];
        
        // Calcular distancia entre el personaje y el objeto
        const distancia = nuevaPosicion.distanceTo(objetoColision.centro);
        
        // Si la distancia es menor que la suma de los radios, hay colisión
        if (distancia < (radioPersonaje + objetoColision.radio)) {
            return true;
        }
    }
    return false;
}

// Función original mantenida por compatibilidad
function verificarColision(nuevaPosicion) {
    return verificarColisionMejorada(nuevaPosicion);
}