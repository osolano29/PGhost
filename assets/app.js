// ================ CONFIGURACIÓN ================
import { CONTRACT_CONFIG, AMOY_CONFIG } from './ghost-token.js';
import { getContractConfigSafe, AMOY_CONFIG } from './ghost-token.js';

// Variables globales
let web3, contract, userAddress, isOwner = false, isAuxiliary = false;

// ================ UTILIDADES ================
// Añadir al inicio del archivo
const utils = {
    showLoader(message = "") {
        if (DOM.loader) {
            DOM.loader.style.display = 'flex';
            if (message && DOM.loaderText) {
                DOM.loaderText.textContent = message;
            }
        }
    },
    hideLoader() {
        if (DOM.loader) {
            DOM.loader.style.display = 'none';
        }
    },
    /*compareAddresses = (addr1, addr2) => {
        return addr1 && addr2 && addr1.toLowerCase() === addr2.toLowerCase();
    },*/
    toWei(amount) {
        if (!web3) throw new Error("Web3 no está inicializado");
        return web3.utils.toWei(amount.toString(), 'ether');
    },
    fromWei(amount) {
        if (!web3) throw new Error("Web3 no está inicializado");
        return web3.utils.fromWei(amount.toString(), 'ether');
    }
};

// Elementos del DOM
const DOM = {
    // Conexión
    connectBtn: document.getElementById('connectWallet'),
    disconnectBtn: document.getElementById('disconnectWallet'),
    walletStatus: document.getElementById('networkStatusText'),
    walletInfo: document.getElementById('walletInfo'),
    walletAddress: document.getElementById('walletAddress'),
    networkStatus: document.getElementById('networkStatus'),
    copyWalletAddress: document.getElementById('copyWalletAddress'),
    copyContractAddress: document.getElementById('copyContractAddress'),
    contractAddressShort: document.getElementById('contractAddressShort'),
    
    // Tokens
    tokenBalance: document.getElementById('tokenBalance'),
    totalSupply: document.getElementById('totalSupply'),
    contractStatus: document.getElementById('contractPausedStatus'),
    walletStatusIndicator: document.getElementById('walletPausedStatus'),
    refreshBalance: document.getElementById('refreshBalance'),
    
    // Transferencias
    recipientAddress: document.getElementById('recipientAddress'),
    transferAmount: document.getElementById('transferAmount'),
    transferBtn: document.getElementById('transferTokens'),
    estimateTransferGas: document.getElementById('estimateTransferGas'),
    transferGasEstimate: document.getElementById('transferGasEstimate'),
    transferGasUsed: document.getElementById('transferGasUsed'),
    
    // Mint/Burn
    mintAddress: document.getElementById('mintAddress'),
    mintAmount: document.getElementById('mintAmount'),
    mintBtn: document.getElementById('mintTokens'),
    estimateMintGas: document.getElementById('estimateMintGas'),
    mintGasEstimate: document.getElementById('mintGasEstimate'),
    mintGasUsed: document.getElementById('mintGasUsed'),
    burnAmount: document.getElementById('burnAmount'),
    burnBtn: document.getElementById('burnTokens'),
    estimateBurnGas: document.getElementById('estimateBurnGas'),
    burnGasEstimate: document.getElementById('burnGasEstimate'),
    burnGasUsed: document.getElementById('burnGasUsed'),
    
    // Pausas
    pauseWalletBtn: document.getElementById('pauseWallet'),
    unpauseWalletBtn: document.getElementById('unpauseWallet'),
    pauseContractBtn: document.getElementById('pauseContract'),
    unpauseContractBtn: document.getElementById('unpauseContract'),
    
    // Auxiliar
    newAuxiliary: document.getElementById('newAuxiliary'),
    setAuxiliaryBtn: document.getElementById('setAuxiliaryBtn'),
    claimOwnershipBtn: document.getElementById('claimOwnershipBtn'),
    auxiliaryAddress: document.getElementById('auxiliaryAddress'),
    
    // UI
    loader: document.getElementById('loader'),
    loaderText: document.getElementById('loaderText'),
    notification: document.getElementById('notification'),
    notificationMessage: document.getElementById('notificationMessage'),
    ownerSection: document.getElementById('ownerSection'),
    auxiliarySection: document.getElementById('auxiliarySection'),
    metaMaskModal: document.getElementById('metaMaskModal'),
    
    // Configuración de Gas
    gasConfigPanel: document.getElementById('gasConfigPanel'),
    closeGasConfig: document.getElementById('closeGasConfig'),
    applyGasConfig: document.getElementById('applyGasConfig'),
    customGasPrice: document.getElementById('customGasPrice'),
    customGasLimit: document.getElementById('customGasLimit'),
    speedButtons: document.querySelectorAll('.speed-btn')
};

// ================ FUNCIONES PRINCIPALES ================
const initApp = async () => {
  try{  
      // Verificar compatibilidad del navegador
    if (!isBrowserCompatible()) {
        showBrowserWarning();
        return;
    }
    setupEventListeners();
    
    if (window.location.protocol === 'file:') {
        console.warn('Modo local detectado - Algunas funciones pueden estar limitadas');
    }
    
    if (window.ethereum?.selectedAddress) {
        await connectWallet();
    }
  } catch (error) {
        //console.error("Error inicializando la app:", error);
        handleCSPError(error);
  }    
}

function detectProvider() {
  try { 
    if (typeof window.ethereum !== 'undefined') {
        // Manejar múltiples proveedores
        if (window.ethereum.providers?.length) {
            return window.ethereum.providers.find(p => p.isMetaMask) || window.ethereum;
        }
        return window.ethereum;
    }
    
    if (typeof window.web3 !== 'undefined' && window.web3.currentProvider?.isMetaMask) {
        return window.web3.currentProvider;
    }
    
    if (window.ethereum?.isMetaMask) {
        return window.ethereum;
    }
  } catch(error) { 
     console.error("Error detectando provider:", error);
     if (error.message.includes("Content Security Policy")) {
         showNotification("Error de seguridad: Configuración de CSP bloqueada", "error");
     }
    return null;
  }
}

//nueva safe *****************
const detectProviderSafe = async () => {
  try {
    if (window.ethereum) {
      // Verificación adicional para MetaMask
      if (window.ethereum.isMetaMask) {
        await window.ethereum.request({ method: 'eth_chainId' });
      }
      return window.ethereum;
    }
    
    showMetaMaskModal();
    return null;
  } catch (error) {
    handleCSPError(error);
    return null;
  }
};

const handleCSPError = (error) => {
  console.error("Error de seguridad:", error);
  
  // Detección de errores relacionados con CSP
  if (/Content Security Policy|eval|Function/i.test(error.message)) {
    showNotification(`
      Error de seguridad: 
      Por favor actualiza tu navegador o desactiva extensiones que puedan interferir
    `, "error");
  } else {
    handleError(error, "Error en la aplicación");
  }
};

const isBrowserCompatible = () => {
  try {
    // Pruebas seguras de funcionalidades requeridas
    return (
      typeof Web3 === 'function' &&
      typeof window.ethereum === 'object' &&
      'request' in window.ethereum &&
      !navigator.userAgent.match(/PhantomJS/i)
    );
  } catch (e) {
    return false;
  }
};
// Comprueba si el script se está ejecutando como módulo
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    initApp().catch(handleCSPError);
  });
}
//*********

const connectWallet = async () => {
    try {
        utils.showLoader("Conectando wallet...");
        
        /*const provider = detectProvider();
        if (!provider) {
            showMetaMaskModal();
            return false;
        }*/
        // Detección segura del provider
        const provider = await detectProviderSafe();
        if (!provider) return false;

       // Inicialización segura de Web3
        web3 = new Web3(provider);
        
        // Solicita cuentas de forma moderna (EIP-1102)
        const accounts = await provider.request({ 
            method: 'eth_requestAccounts',
            params: [{ eth_chainId: AMOY_CONFIG.chainId }] // Especifica la cadena
        }).catch(handleCSPError);
        
        if (!accounts || accounts.length === 0) {
            throw new Error("No se encontraron cuentas");
        }
        userAddress = accounts[0];
        
        await setupNetwork();
       /* if (!initContract()) {
            throw new Error("No se pudo inicializar el contrato");
        }*/
        await initContractSafe();
        await loadInitialData();
        updateUI();
        showNotification("¡Conectado correctamente!", "success");
        return true;
        
    } catch (error) {
        //handleError(error, "Error al conectar");
        handleCSPError(error);
        return false;
    } finally {
        utils.hideLoader();
    }
}

// ====== NUEVA FUNCIÓN DISCONNECT WALLET ======
async function disconnectWallet() {
    try {
        // Limpiar estado
        userAddress = null;
        isOwner = false;
        isAuxiliary = false;
        
        // Resetear UI
        updateUI();
        
        // Cerrar conexión si es posible
        if (window.ethereum && window.ethereum.close) {
            await window.ethereum.close();
        }
        
        showNotification("Wallet desconectada", "info");
    } catch (error) {
        console.error("Error al desconectar:", error);
        showNotification("Error al desconectar", "error");
    }
}

function showMetaMaskModal() {
    if (DOM.metaMaskModal) {
        DOM.metaMaskModal.style.display = 'block'; //'flex';
        
        // Agregar evento para cerrar el modal
        const closeBtn = DOM.metaMaskModal.querySelector('.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                DOM.metaMaskModal.style.display = 'none';
            });
        }
    }
}
async function setupNetwork() {
    try {
        // Verifica si estamos en la red correcta (Polygon Amoy)
        const chainId = await web3.eth.getChainId();
        if (chainId.toString() !== AMOY_CONFIG.chainId) {
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: AMOY_CONFIG.chainId }],
                });
            } catch (switchError) {
                // Si la red no está agregada, intentar agregarla
                if (switchError.code === 4902) {
                    try {
                        await window.ethereum.request({
                            method: 'wallet_addEthereumChain',
                            params: [AMOY_CONFIG],
                        });
                    } catch (addError) {
                        throw new Error("No se pudo agregar la red Polygon Amoy");
                    }
                } else {
                    throw switchError;
                }
            }
        }
    } catch (error) {
        console.error("Error configurando la red:", error);
        throw error;
    }
}

// ================ FUNCIÓN SEGURA PARA INICIALIZAR CONTRATO ================
const initContractSafe = async () => {
  try {
    const safeConfig = getContractConfigSafe();
      // Validación previa
    if (!web3 || !web3.eth) throw new Error("Web3 no está disponible");
    
    // Creación segura de la instancia del contrato
    contract = new web3.eth.Contract(
      safeConfig.abi,
      safeConfig.networks["80002"].address,
      /*CONTRACT_CONFIG.abi,
      CONTRACT_CONFIG.networks["80002"].address,*/
      {
        handleRevert: true,
        dataInputFill: 'allow'
      }
    );

    // Verificación de que los métodos están disponibles
    if (!contract.methods || !contract.methods.balanceOf) {
      throw new Error("Los métodos del contrato no están disponibles");
    }

    return true;
  } catch (error) {
    handleCSPError(error);
    return false;
  }
};

// nuevas seguras
// ================ FUNCIÓN SEGURA PARA INICIALIZAR CONTRATO ================
// ================ FUNCIONES AUXILIARES SEGURAS ================
const detectProviderSafe = async () => {
  try {
    if (window.ethereum) {
      // Verificación adicional para MetaMask
      if (window.ethereum.isMetaMask) {
        await window.ethereum.request({ method: 'eth_chainId' });
      }
      return window.ethereum;
    }
    
    showMetaMaskModal();
    return null;
  } catch (error) {
    handleCSPError(error);
    return null;
  }
};

const handleCSPError = (error) => {
  console.error("Error de seguridad:", error);
  
  // Detección de errores relacionados con CSP
  if (/Content Security Policy|eval|Function/i.test(error.message)) {
    showNotification(`
      Error de seguridad: 
      Por favor actualiza tu navegador o desactiva extensiones que puedan interferir
    `, "error");
  } else {
    handleError(error, "Error en la aplicación");
  }
};

const isBrowserCompatible = () => {
  try {
    // Pruebas seguras de funcionalidades requeridas
    return (
      typeof Web3 === 'function' &&
      typeof window.ethereum === 'object' &&
      'request' in window.ethereum &&
      !navigator.userAgent.match(/PhantomJS/i)
    );
  } catch (e) {
    return false;
  }
};
// fin seguras

function initContract() {
  try {
    if (!web3) {
        throw new Error("Web3 no está inicializado");
    }
    contract = new web3.eth.Contract(
        CONTRACT_CONFIG.abi,
        //CONTRACT_CONFIG.address
        CONTRACT_CONFIG.networks["80002"].address,
        {
           // Opciones adicionales para mayor seguridad
           dataInputFill: 'allow', // Evita procesamiento peligroso
           transactionPollingTimeout: 180000 // 3 minutos
        }
    );
    // Verificación de que el contrato se inicializó correctamente
    if (!contract || !contract.methods) {
        throw new Error("El contrato no se inicializó correctamente");
    }
    // Configura manejadores seguros de eventos
    configureContractEventHandlers();
      
    // Configurar la dirección corta del contrato
    if (DOM.contractAddressShort) {
        DOM.contractAddressShort.title = CONTRACT_CONFIG.address;
        DOM.contractAddressShort.dataset.fullAddress = CONTRACT_CONFIG.address;
    }
    console.log("Contrato inicializado con éxito");
    return true;  
  } catch (error) {
    // Manejo específico de errores de CSP
     if (error.message.includes("Content Security Policy") || 
         error.message.includes("eval") || 
         error.message.includes("Function")) {
            console.error("Error de CSP:", error);
            showNotification("Error de configuración de seguridad. Actualiza tu navegador o verifica las políticas de contenido.", "error");
     } else {
            handleError(error, "Error inicializando contrato");
     }
        return false;
  }
}
function configureContractEventHandlers() {
    if (!contract) return;
    // Manejadores de eventos seguros (sin eval)
    const eventHandlers = {
        'Transfer': (event) => {
            console.log("Evento Transfer:", event);
            if (event.returnValues.from === userAddress || 
                event.returnValues.to === userAddress) {
                updateTokenBalance();
            }
        },
        'Approval': (event) => {
            console.log("Evento Approval:", event);
        },
        // Agrega más manejadores según sea necesario
    };

    // Suscribe los eventos de forma segura
    Object.keys(eventHandlers).forEach(eventName => {
        contract.events[eventName]()
            .on('data', eventHandlers[eventName])
            .on('error', err => {
                console.error(`Error en evento ${eventName}:`, err);
            });
    });
}

function showNotification(message, type = "info") {
    if (!DOM.notification || !DOM.notificationMessage) return;
    
    DOM.notificationMessage.textContent = message;
    DOM.notification.className = `notification ${type}`;
    DOM.notification.style.display = 'block';
    
    setTimeout(() => {
        DOM.notification.style.display = 'none';
    }, 5000);
}

function handleError(error, context = "") {
    console.error(context, error);
    let message = error.message || "Error desconocido";
    
    // Simplificar mensajes de error de MetaMask
    if (message.includes("User denied")) {
        message = "Transacción cancelada por el usuario";
    } else if (message.includes("insufficient funds")) {
        message = "Fondos insuficientes para la transacción";
    }
    
    showNotification(`${context}: ${message}`, "error");
}

// ================ FUNCIONES DEL CONTRATO ================
async function loadInitialData() {
    try {
        utils.showLoader("Cargando datos...");
        // Verificación adicional de seguridad
        if (!contract || !contract.methods) {
            throw new Error("El contrato no está disponible");
        }
        // Usa Promise.all para llamadas seguras
        const [balance, supply, paused, walletPaused, auxiliary] = await Promise.all([
            contract.methods.balanceOf(userAddress).call(),
            contract.methods.totalSupply().call(),
            contract.methods.paused().call(),
            contract.methods.isWalletPaused(userAddress).call(),
            contract.methods.auxiliaryOwner().call()
        ]);
        
        DOM.tokenBalance.textContent = `${fromWei(balance)} GO`;
        DOM.totalSupply.textContent = `${fromWei(supply)} GO`;
        DOM.contractStatus.textContent = paused ? '⛔ PAUSADO' : '✅ Activo';
        DOM.walletStatusIndicator.textContent = walletPaused ? '⛔ PAUSADA' : '✅ Activa';
        DOM.auxiliaryAddress.textContent = auxiliary === '0x0000000000000000000000000000000000000000' ? 
            'No asignado' : utils.shortAddress(auxiliary);
        // Verificación de roles segura
        const owner = await contract.methods.owner().call();
        isOwner = userAddress.toLowerCase() === owner.toLowerCase();
        isAuxiliary = userAddress.toLowerCase() === auxiliary.toLowerCase();
        /*isOwner = utils.compareAddresses(userAddress, owner);
        isAuxiliary = utils.compareAddresses(userAddress, auxiliary);*/
        toggleRoleSections();
        
    } catch (error) {
        handleError(error, "Error cargando datos iniciales");
    } finally {
        utils.hideLoader();
    }
}

// ================ TRANSACCIONES ================
async function estimateTransactionGas(methodName, args = [], estimateElementId = null) {
    const gasOptions = getGasOptions();
    
    try {
        if (!userAddress) {
            showNotification("Conecta tu wallet primero", "error");
            return null;
        }

        utils.showLoader("Estimando gas...");
        const gasEstimate = await contract.methods[methodName](...args)
            .estimateGas({ from: userAddress, ...gasOptions });
        
        if (estimateElementId && DOM[estimateElementId]) {
            DOM[estimateElementId].textContent = gasEstimate;
        }
        
        return gasEstimate;
    } catch (error) {
        handleError(error, "Error estimando gas");
        return null;
    } finally {
        utils.hideLoader();
    }
}

function getGasOptions() {
    const options = {};
    if (DOM.customGasPrice.value) {
        options.gasPrice = web3.utils.toWei(DOM.customGasPrice.value, 'gwei');
    }
    if (DOM.customGasLimit.value) {
        options.gas = DOM.customGasLimit.value;
    }
    return options;
}

async function mintTokens() {
    if (!isOwner) {
        showNotification("Solo el owner puede mintear tokens", "error");
        return;
    }
    
    try {
        if (!validateMintInputs()) return;
        
        const recipient = DOM.mintAddress.value;
        const amount = DOM.mintAmount.value;
        const gasOptions = getGasOptions();
        
        const gasEstimate = await estimateTransactionGas(
            'mint',
            [recipient, toWei(amount)],
            'mintGasEstimate'
        );
        
        if (!gasEstimate) return;

        utils.showLoader("Minteando tokens...");
        const tx = await contract.methods.mint(recipient, toWei(amount))
            .send({ 
                from: userAddress, 
                gas: Math.floor(gasEstimate * 1.2),
                ...gasOptions
            });
        
        showGasUsed(tx, 'mintGasUsed');
        showNotification(`Tokens minteados exitosamente! Gas usado: ${tx.gasUsed}`, "success");
        await loadInitialData();
        
    } catch (error) {
        if (error.receipt) {
            showGasUsed(error.receipt, 'mintGasUsed');
            handleError(error, `Error minteando tokens (Gas usado: ${error.receipt.gasUsed})`);
        } else {
            handleError(error, "Error minteando tokens");
        }
    } finally {
        utils.hideLoader();
    }
}

function validateMintInputs() {
    let isValid = true;
    
    if (!DOM.mintAddress.value || !web3.utils.isAddress(DOM.mintAddress.value)) {
        DOM.mintAddress.classList.add('input-error');
        isValid = false;
    } else {
        DOM.mintAddress.classList.remove('input-error');
    }
    
    if (!DOM.mintAmount.value || Number(DOM.mintAmount.value) <= 0) {
        DOM.mintAmount.classList.add('input-error');
        isValid = false;
    } else {
        DOM.mintAmount.classList.remove('input-error');
    }
    
    if (!isValid) {
        showNotification("Corrige los campos marcados", "error");
    }
    
    return isValid;
}

async function transferTokens() {
    try {
        if (!validateTransferInputs()) return;
        
        const recipient = DOM.recipientAddress.value;
        const amount = DOM.transferAmount.value;
        const gasOptions = getGasOptions();
        
        const gasEstimate = await estimateTransactionGas(
            'transfer',
            [recipient, toWei(amount)],
            'transferGasEstimate'
        );
        
        if (!gasEstimate) return;

        utils.showLoader("Enviando transferencia...");
        const tx = await contract.methods.transfer(recipient, toWei(amount))
            .send({ 
                from: userAddress, 
                gas: Math.floor(gasEstimate * 1.2),
                ...gasOptions
            });
        
        showGasUsed(tx, 'transferGasUsed');
        showNotification(`Transferencia exitosa! Gas usado: ${tx.gasUsed}`, "success");
        await loadInitialData();
        
    } catch (error) {
        if (error.receipt) {
            showGasUsed(error.receipt, 'transferGasUsed');
            handleError(error, `Error en transferencia (Gas usado: ${error.receipt.gasUsed})`);
        } else {
            handleError(error, "Error en transferencia");
        }
    } finally {
        utils.hideLoader();
    }
}

function validateTransferInputs() {
    let isValid = true;
    
    if (!DOM.recipientAddress.value || !web3.utils.isAddress(DOM.recipientAddress.value)) {
        DOM.recipientAddress.classList.add('input-error');
        isValid = false;
    } else {
        DOM.recipientAddress.classList.remove('input-error');
    }
    
    if (!DOM.transferAmount.value || Number(DOM.transferAmount.value) <= 0) {
        DOM.transferAmount.classList.add('input-error');
        isValid = false;
    } else {
        DOM.transferAmount.classList.remove('input-error');
    }
    
    if (!isValid) {
        showNotification("Corrige los campos marcados", "error");
    }
    
    return isValid;
}

// ================ UTILIDADES ================
function toWei(amount) {
    return web3.utils.toWei(amount.toString(), 'ether');
}

function fromWei(amount) {
    return web3.utils.fromWei(amount.toString(), 'ether');
}

function shortAddress(address) {
    return address ? `${address.substring(0, 6)}...${address.substring(38)}` : "N/A";
}

function updateUI() {
    if (userAddress) {
        DOM.walletStatus.textContent = shortAddress(userAddress);
        DOM.networkStatus.className = 'connection-status-badge connected';
        DOM.walletInfo.style.display = 'flex';
        DOM.walletAddress.textContent = shortAddress(userAddress);
        DOM.connectBtn.style.display = 'none';
        DOM.disconnectBtn.style.display = 'block';
    } else {
        DOM.walletStatus.textContent = 'Desconectado';
        DOM.networkStatus.className = 'connection-status-badge disconnected';
        DOM.walletInfo.style.display = 'none';
        DOM.connectBtn.style.display = 'block';
        DOM.disconnectBtn.style.display = 'none';
    }
    toggleRoleSections();
}

function toggleRoleSections() {
    if (isOwner) {
        DOM.ownerSection.style.display = 'block';
    } else {
        DOM.ownerSection.style.display = 'none';
    }
    
    if (isAuxiliary) {
        DOM.auxiliarySection.style.display = 'block';
    } else {
        DOM.auxiliarySection.style.display = 'none';
    }
}

function setupEventListeners() {
    // Verificar existencia de elementos antes de añadir listeners
    const elementsToCheck = [
        'connectWallet', 'disconnectWallet', 'copyWalletAddress', 
        'copyContractAddress', 'transferTokens', 'estimateTransferGas',
        'mintTokens', 'estimateMintGas'
    ];

    elementsToCheck.forEach(id => {
        if (!DOM[id]) {
            console.error(`Elemento no encontrado: ${id}`);
        }
    });
    
    // Conexión
    if (DOM.connectBtn) {
        DOM.connectBtn.addEventListener('click', connectWallet);
    }
    if (DOM.disconnectBtn) {
        DOM.disconnectBtn.addEventListener('click', disconnectWallet);
    }
    DOM.refreshBalance.addEventListener('click', loadInitialData);
    
    // Copiar direcciones
    DOM.copyWalletAddress?.addEventListener('click', () => {
        navigator.clipboard.writeText(userAddress)
            .then(() => showNotification("¡Dirección copiada!", "success"))
            .catch(err => console.error('Error al copiar:', err));
    });
    
    DOM.copyContractAddress.addEventListener('click', () => {
        const fullAddress = DOM.contractAddressShort.dataset.fullAddress;
        navigator.clipboard.writeText(fullAddress)
            .then(() => showNotification("¡Contrato copiado!", "success"))
            .catch(err => console.error('Error al copiar:', err));
    });
    
    // Transferencias
    DOM.transferBtn?.addEventListener('click', transferTokens);
    DOM.estimateTransferGas?.addEventListener('click', () => {
        estimateTransactionGas(
            'transfer',
            [DOM.recipientAddress.value, toWei(DOM.transferAmount.value)],
            'transferGasEstimate'
        );
    });
    
    // Mint
    DOM.mintBtn?.addEventListener('click', mintTokens);
    DOM.estimateMintGas?.addEventListener('click', () => {
        if (!validateMintInputs()) return;
        estimateTransactionGas(
            'mint',
            [DOM.mintAddress.value, toWei(DOM.mintAmount.value)],
            'mintGasEstimate'
        );
    });
    
     // Configuración de Gas (versión mejorada con validación)
    const gasConfigButtons = document.querySelectorAll('.gas-config-btn');
    if (gasConfigButtons.length > 0) {
        gasConfigButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                if (DOM.gasConfigPanel) {
                    DOM.gasConfigPanel.style.display = 'block';
                }
            });
        });
    }

    if (DOM.closeGasConfig && DOM.gasConfigPanel) {
        DOM.closeGasConfig.addEventListener('click', () => {
            DOM.gasConfigPanel.style.display = 'none';
        });
    }

    if (DOM.applyGasConfig) {
        DOM.applyGasConfig.addEventListener('click', applyGasConfig);
    }

    // Pestañas (versión segura)
    const tabButtons = document.querySelectorAll('.tab-btn');
    if (tabButtons.length > 0) {
        tabButtons.forEach(btn => {
            btn.addEventListener('click', switchTab);
        });
    }
}

function applyGasConfig() {
    const speed = document.querySelector('.speed-btn.active').dataset.speed;
    console.log('Configuración de gas aplicada:', { 
        gasPrice: DOM.customGasPrice.value,
        gasLimit: DOM.customGasLimit.value,
        speed 
    });
    DOM.gasConfigPanel.style.display = 'none';
}

function showGasUsed(txReceipt, elementId) {
    if (txReceipt.gasUsed && DOM[elementId]) {
        DOM[elementId].textContent = txReceipt.gasUsed;
    }
}

function switchTab(e) {
    const tabId = e.currentTarget.getAttribute('data-tab');
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(tabId).classList.add('active');
    e.currentTarget.classList.add('active');
}

// Inicialización para módulos ES6 (Versión definitiva)
document.addEventListener('DOMContentLoaded', () => {
    // Verificar si es el script principal (evita doble ejecución si es importado)
    if (import.meta.url !== document.currentScript?.src) return;
    
    // Verificar si MetaMask está instalado
    if (typeof window.ethereum === 'undefined') {
        console.warn('MetaMask no está instalado');
        showMetaMaskModal();
        return; // Salir temprano si no hay provider
    }

    // Inicializar la aplicación con manejo de errores
    initApp()
        .then(() => console.debug('Aplicación inicializada correctamente'))
        .catch(error => {
            console.error("Error inicializando la aplicación:", error);
            handleError(error, "Error al iniciar la aplicación");
        });
});

// Exporta las funciones necesarias para testing o uso externo
/*export {
    connectWallet,
    disconnectWallet,
    transferTokens,
    mintTokens
    //initApp
};*/
