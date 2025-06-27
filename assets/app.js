// ================ CONFIGURACIÓN ================
import { CONTRACT_CONFIG, AMOY_CONFIG } from './ghost-token.js';

// Variables globales
let web3, contract, userAddress, isOwner = false, isAuxiliary = false;
let contractEventSubscriptions = [];

// ================ UTILIDADES ================
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
    compareAddresses(addr1, addr2) {
        return addr1 && addr2 && addr1.toLowerCase() === addr2.toLowerCase();
    }
};

function toWei(amount) {
  if (amount === null || amount === undefined || amount === '' || isNaN(amount)) {
    throw new Error("Cantidad inválida para conversión a wei");
  }
  return web3.utils.toWei(amount.toString(), 'ether');
}

function fromWei(amount) {
  try {
    const value = web3.utils.fromWei(amount.toString(), 'ether');
    return parseFloat(value).toFixed(decimals).replace(/\.?0+$/, '');
  } catch (e) {
    console.error("Error en fromWei:", e);
    return '0';
  }
}

function shortAddress(address) {
    return address ? `${address.substring(0, 6)}...${address.substring(38)}` : "N/A";
}
  // Función de reconexión. Mantener la función handleReconnect separada (más limpia y reutilizable)
async function handleReconnect() {
    try {
        updateConnectionStatus('reconnecting');
        toggleReconnectButton(false);
        utils.showLoader("Reconectando...");
        
        // 1. Cerrar conexiones existentes
        if (contractEvents?.currentProvider?.disconnect) {
            contractEvents.currentProvider.disconnect();
        }
        
        // 2. Reintentar conexión completa
        const success = await connectWallet();
        
        if (!success) {
            throw new Error("No se pudo reconectar");
        }
        
        showNotification("¡Reconexión exitosa!", "success");
        return true;
    } catch (error) {
        console.error("Error en reconexión:", error);
        handleError(error, "Error al reconectar");
        toggleReconnectButton(true);
        return false;
    } finally {
        utils.hideLoader();
    }
}

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
    estimateTransferGas: document.getElementById('estimateTransferGas'), //??
    transferGasEstimate: document.getElementById('transferGasEstimate'), //html
    transferGasUsed: document.getElementById('transferGasUsed'), //html
    
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
    auxiliaryGasEstimate: document.getElementById('auxiliaryGasEstimate'),
    auxiliaryGasUsed: document.getElementById('auxiliaryGasUsed'),
  
    /*estimateSetAuxiliaryGas: document.getElementById('estimateSetAuxiliaryGas'),  //***
      estimateClaimOwnershipGas: document.getElementById('estimateClaimOwnershipGas'), //*** */

    // Aprobación de gastos
    spenderContract: document.getElementById('spenderContract'),
    approvalAmount: document.getElementById('approvalAmount'),
    approvalGasEstimate: document.getElementById('approvalGasEstimate'),
    approvalGasUsed: document.getElementById('approvalGasUsed'),
    estimateApprovalGas: document.getElementById('estimateApprovalGas'),
    approveTokens: document.getElementById('approveTokens'),
    
    // UI
    loader: document.getElementById('loader'),
    loaderText: document.getElementById('loaderText'),
    notification: document.getElementById('notification'),
    notificationMessage: document.getElementById('notificationMessage'),
    ownerSection: document.getElementById('ownerSection'),
    auxiliarySection: document.getElementById('auxiliarySection'),
    metaMaskModal: document.getElementById('metaMaskModal'),

    // Sistema de recovery
    approveRecoveryBtn: document.getElementById('approveRecoveryBtn'),
    estimateApproveRecoveryGas: document.getElementById('estimateApproveRecoveryGas'), //??
    executeRecoveryBtn: document.getElementById('executeRecoveryBtn'),
    estimateExecuteRecoveryGas: document.getElementById('estimateExecuteRecoveryGas'),  //??
    recoveryNominee: document.getElementById('recoveryNominee'),
    recoveryDeadline: document.getElementById('recoveryDeadline'),
    recoveryApproved: document.getElementById('recoveryApproved'),
    recoveryRemainingTime: document.getElementById('recoveryRemainingTime'),
    recoveryGasEstimate: document.getElementById('recoveryGasEstimate'),
    recoveryGasUsed: document.getElementById('recoveryGasUsed'),
    
    // Configuración de Gas
    gasConfigPanel: document.getElementById('gasConfigPanel'),
    closeGasConfig: document.getElementById('closeGasConfig'),
    applyGasConfig: document.getElementById('applyGasConfig'),
    customGasPrice: document.getElementById('customGasPrice'),
    customGasLimit: document.getElementById('customGasLimit'),
//gas de pausa
    estimatePauseGas: document.getElementById('estimatePauseGas'),    //***
    estimateUnpauseGas: document.getElementById('estimateUnpauseGas'),//****
    pauseGasEstimate: document.getElementById('pauseGasEstimate'),    //*****
    pauseGasUsed: document.getElementById('pauseGasUsed'),            //******  

    speedButtons: document.querySelectorAll('.speed-btn')
};

// ================ FUNCIONES PRINCIPALES ================
const initApp = async () => {
    try {
        if (!isBrowserCompatible()) {
            showNotification("Tu navegador no es compatible con Web3. Por favor usa Chrome o Firefox con MetaMask.", "error");
            return;
        }
        
        setupEventListeners();
        
        if (window.ethereum?.selectedAddress) {
            await connectWallet();
        }
        
        setupWalletListeners();
    } catch (error) {
        handleCSPError(error);
    }
}

const detectProviderSafe = async () => {
    try {
        if (window.ethereum) {
            const timeoutPromise = new Promise((_, reject) => 
               setTimeout(() => reject(new Error("Timeout al detectar proveedor")), 5000)
            );
            if (Array.isArray(window.ethereum.providers)) {
                const provider = window.ethereum.providers.find(p => p.isMetaMask) || window.ethereum;
                await Promise.race([
                   provider.request({ method: 'eth_chainId' }),
                   timeoutPromise
                ]);
                return provider;
            }

            // Verificación con timeout
            await Promise.race([
              window.ethereum.request({ method: 'eth_chainId' }),
              timeoutPromise
            ]);
            return window.ethereum;
        }
        // Compatibilidad con versiones antiguas
        if (typeof window.web3 !== 'undefined' && window.web3.currentProvider?.isMetaMask) {
            return window.web3.currentProvider;
        }

        showMetaMaskModal();
        return null;
    } catch (error) {
        console.error("Error detectando proveedor:", error);
        if (error.message.includes("Timeout")) {
           showNotification("El proveedor no respondió a tiempo. Intente recargar la página.", "error");
        } else if (error.message.includes("Content Security Policy")) {
           showNotification("Error de seguridad del navegador (CSP)", "error");
        } else {
           showNotification("Error al conectar con el proveedor Web3", "error");
        }
        return null;
    }
};

const isBrowserCompatible = () => {
    try {
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

function getWebSocketContract(config, networkId = "80002") {
  try {
    const wssUrl = "wss://rpc-amoy.polygon.technology";
    
    // Configurar reconexión automática
    const providerOptions = {
      reconnect: {
        auto: true,
        delay: 5000, // ms
        maxAttempts: 5,
        onTimeout: false
      }
    };
    
    const provider = new Web3.providers.WebsocketProvider(wssUrl, providerOptions);
    const web3Events = new Web3(provider);

    // Manejar eventos de conexión/desconexión
    provider.on('connect', () => console.log("WebSocket conectado"));
    provider.on('close', () => console.log("WebSocket desconectado"));
    provider.on('error', (err) => console.error("Error WebSocket:", err));

    if (!config || !config.abi || !config.networks || !config.networks[networkId]) {
      throw new Error(`Configuración de contrato inválida para red ${networkId}`);
    }

    const address = config.networks[networkId].address;
    const contract = new web3Events.eth.Contract(config.abi, address);

    return contract;
  } catch (error) {
    console.error("Error al crear contrato WebSocket:", error);
    return null;
  }
}
async function withRetry(fn, maxRetries = 3, delay = 1000) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.warn(`Intento ${i + 1} fallido. Reintentando...`, error);
      
      // Esperar antes del próximo intento (con backoff exponencial)
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      
      // Verificar si es un error de conexión
      if (error.message.includes("reconnect") || error.message.includes("connection")) {
        continue;
      }
      break;
    }
  }
  
  throw lastError;
}
// Función para mostrar/ocultar el botón de reconexión
function toggleReconnectButton(show) {
    const reconnectBtn = document.getElementById('reconnectBtn');
    if (reconnectBtn) {
        reconnectBtn.style.display = show ? 'block' : 'none';
    }
}

const connectWallet = async () => {
  try {
    utils.showLoader("Conectando wallet...");
    
    return await withRetry(async () => {
      const provider = await detectProviderSafe();
      if (!provider) return false;

      web3 = new Web3(provider);
      const accounts = await provider.request({ 
        method: 'eth_requestAccounts',
        params: [{ eth_chainId: AMOY_CONFIG.chainId }]
      });

      if (!accounts || accounts.length === 0) {
        throw new Error("No se encontraron cuentas");
      }

      userAddress = accounts[0];
      await setupNetwork();
      await initContractSafe();

      contractEvents = getWebSocketContract(CONTRACT_CONFIG);
      if (contractEvents) {
        configureContractEventHandlers();
      }

      await loadInitialData();
      updateUI();
      showNotification("¡Conectado correctamente!", "success");
      return true;
    });
  } catch (error) {
    handleCSPError(error);
    return false;
  } finally {
    utils.hideLoader();
  }
};

async function disconnectWallet() {
    try {
        clearEventSubscriptions();
        userAddress = null;
        isOwner = false;
        isAuxiliary = false;
        updateUI();
        // Cerrar conexión si es posible
        if (window.ethereum && window.ethereum.close) {
            await window.ethereum.close();
        }
        showNotification("Wallet desconectada", "info");
    } catch (error) {
        handleError(error, "Error al desconectar");
    }
}

function showMetaMaskModal() {
    if (DOM.metaMaskModal) {
        DOM.metaMaskModal.style.display = 'block';
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
        const chainId = await web3.eth.getChainId();
        if (chainId.toString() !== AMOY_CONFIG.chainId) {
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: AMOY_CONFIG.chainId }],
                });
            } catch (switchError) {
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

const initContractSafe = async () => {
    try {
        if (!web3 || !web3.eth) {
            throw new Error("Web3 no está inicializado correctamente");
        }

        const config = CONTRACT_CONFIG;
        const networkId = "80002";
        
        if (!config.networks || !config.networks[networkId]) {
            throw new Error(`La red ${networkId} no está configurada en el contrato`);
        }

        contract = new web3.eth.Contract(
            config.abi,
            config.networks[networkId].address,
            {
                handleRevert: true,
                dataInputFill: 'allow',
                transactionPollingTimeout: 180000 // 3 minutos
            }
        );

        if (!contract || !contract.methods) {
            throw new Error("El contrato no se inicializó correctamente");
        }

        configureContractEventHandlers();

        if (DOM.contractAddressShort) {
            const fullAddress = config.networks[networkId].address;
            DOM.contractAddressShort.textContent = shortAddress(fullAddress);
            DOM.contractAddressShort.title = fullAddress;
            DOM.contractAddressShort.dataset.fullAddress = fullAddress;
        }

        console.log("✅ Contrato inicializado con éxito");
        return true;
    } catch (error) {
        handleCSPError(error);
        return false;
    }
};

function clearEventSubscriptions() {
    contractEventSubscriptions.forEach(sub => {
        try {
            sub.unsubscribe();
        } catch (e) {
            console.warn("Error al desuscribir evento:", e);
        }
    });
    contractEventSubscriptions = [];
}

function configureContractEventHandlers() {
  if (!contractEvents || typeof contractEvents.events !== 'object') {
    console.error("contractEvents no es válido o no tiene eventos.");
    return;
  }
  
  clearEventSubscriptions();
  
  /*const handleReconnect = () => {
    console.log("Reconectando eventos...");
    setTimeout(() => {
      if (contractEvents) {
        configureContractEventHandlers();
      }
    }, 5000);
  };*/

  const potentialHandlers = {
    'Transfer': (event) => {
      if (event.returnValues.from === userAddress || 
          event.returnValues.to === userAddress) {
        updateTokenBalance();
      }
    },
    'Approval': (event) => {
      console.log("Evento Approval:", event);
    },
    'error': (error) => {
      console.error("Error en conexión de eventos:", error);
      handleReconnect();
    },
    'end': () => {
      console.log("Conexión de eventos terminada");
      handleReconnect();
    }
  };


  Object.entries(potentialHandlers).forEach(([eventName, handler]) => {
    if (isEventInABI(eventName) || eventName === 'error' || eventName === 'end') {
      try {
        const subscription = contractEvents.events[eventName]()
          .on('data', handler)
          .on('error', err => {
            console.error(`Error en evento ${eventName}:`, err);
            handleReconnect();
          });
        contractEventSubscriptions.push(subscription);
      } catch (err) {
        console.error(`Fallo al suscribirse a evento ${eventName}:`, err);
      }
    }
  });
}

function setupWalletListeners() {
    if (window.ethereum) {
        window.ethereum.on('accountsChanged', async (accounts) => {
            if (accounts.length === 0) {
                await disconnectWallet();
            } else {
                userAddress = accounts[0];
                await loadInitialData();
                updateUI();
                showNotification("Cuenta cambiada", "info");
            }
        });

        window.ethereum.on('chainChanged', async (chainId) => {
            if (chainId !== AMOY_CONFIG.chainId) {
                showNotification("Por favor cambia a Polygon Amoy", "warning");
            }
            await setupNetwork();
            await loadInitialData();
        });
    }
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
    // Mostrar botón de reconexión para errores de conexión
    if (error.message.includes("disconnected") || 
        error.message.includes("reconnect") ||
        error.message.includes("connection")) {
        toggleReconnectButton(true);
    }

    let message = error.message || "Error desconocido";
    
    if (message.includes("User denied")) {
        message = "Transacción cancelada por el usuario";
    } else if (message.includes("insufficient funds")) {
        message = "Fondos insuficientes para la transacción";
    } else if (message.includes("Content Security Policy")) {
        message = "Error de seguridad del navegador. Actualiza o usa otro navegador.";
    }
    
    showNotification(`${context}: ${message}`, "error");
}

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

function updateRecoveryUI(recoveryData) {
    if (!recoveryData || typeof recoveryData !== 'object') return;
    
    const nominee = recoveryData.nominee || recoveryData[0];
    const deadline = recoveryData.deadline || recoveryData[1];
    const approved = recoveryData.approved || recoveryData[2];
    const remainingTime = recoveryData.remainingTime || recoveryData[3];
    
    if (DOM.recoveryNominee) {
        DOM.recoveryNominee.textContent = nominee === '0x0' ? 'Ninguno' : shortAddress(nominee);
    }
    if (DOM.recoveryDeadline) {
        DOM.recoveryDeadline.textContent = deadline === '0' ? 'N/A' : new Date(deadline * 1000).toLocaleString();
    }
    if (DOM.recoveryApproved) {
        DOM.recoveryApproved.textContent = approved ? '✅ Aprobado' : '❌ No aprobado';
    }
    if (DOM.recoveryRemainingTime) {
        DOM.recoveryRemainingTime.textContent = remainingTime === '0' ? 'N/A' : `${remainingTime} segundos`;
    }
}

async function loadInitialData() {
    try {
        utils.showLoader("Cargando datos...");
        
        if (!contract || !contract.methods || !userAddress) {
            return;   //throw new Error("El contrato no está disponible");
        }

        const results = await Promise.all([
            contract.methods.balanceOf(userAddress).call(),
            contract.methods.totalSupply().call(),
            contract.methods.paused().call(),
            contract.methods.isWalletPaused(userAddress).call(),
            contract.methods.auxiliaryOwner().call(),
            contract.methods.recoveryStatus().call()
        ]);

        const [balance, supply, paused, walletPaused, auxiliary, recovery] = results;

        DOM.contractAddressShort.dataset.fullAddress = CONTRACT_CONFIG.networks["80002"].address;

        DOM.tokenBalance.textContent = `${fromWei(balance)} GO`;
        DOM.totalSupply.textContent = `${fromWei(supply)} GO`;
        DOM.contractStatus.textContent = paused ? '⛔ PAUSADO' : '✅ Activo';
        DOM.walletStatusIndicator.textContent = walletPaused ? '⛔ PAUSADA' : '✅ Activa';
        DOM.auxiliaryAddress.textContent = auxiliary === '0x0000000000000000000000000000000000000000' ? 
            'No asignado' : shortAddress(auxiliary);

        const owner = await contract.methods.owner().call();
        isOwner = utils.compareAddresses(userAddress, owner);
        isAuxiliary = utils.compareAddresses(userAddress, auxiliary);
        toggleRoleSections(); // Mostrar/ocultar funciones según roles
 
        updateRecoveryUI(recovery); // Actualizar datos de recovery
    } catch (error) {
        handleError(error, "Error cargando datos iniciales");
    } finally {
        utils.hideLoader();
    }
}

async function updateTokenBalance() {
    try {
        if (!contract || !userAddress) return;
        
        const balance = await contract.methods.balanceOf(userAddress).call();
        DOM.tokenBalance.textContent = `${fromWei(balance)} GO`;
    } catch (error) {
        console.error("Error actualizando balance:", error);
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
    if (DOM.customGasPrice?.value) {
        options.gasPrice = web3.utils.toWei(DOM.customGasPrice.value, 'gwei');
    }
    if (DOM.customGasLimit?.value) {
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
        const amountInWei = toWei(amount);
        const amountBigInt = BigInt(amountInWei);
        const gasOptions = getGasOptions();
        
        
        const gasEstimate = await estimateTransactionGas(
            'mint',
            [recipient, amountInWei],
            'mintGasEstimate'
        );
        
        if (!gasEstimate) return;

        utils.showLoader("Minteando tokens...");
        const tx = await contract.methods.mint(recipient, amountBigInt.toString()) //amountInWei)
            .send({ 
                from: userAddress,
                gas: Math.floor(gasEstimate * 1.2)
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

async function burnTokens() {
    try {
        
        const amount = DOM.burnAmount.value;
        validateAmount(amount);
        
        const gasEstimate = await estimateTransactionGas(
            'burn',
            [web3.utils.toWei(amount, 'ether')],
            'burnGasEstimate'
        );
        
        if (!gasEstimate) return;

        utils.showLoader("Procesando quema...");
        const tx = await contract.methods.burn(
            web3.utils.toWei(amount, 'ether')
        ).send({ 
            from: userAddress,
            gas: Math.floor(gasEstimate * 1.2)
        });
        
        showGasUsed(tx, 'burnGasUsed');
        showNotification(`Tokens quemados exitosamente! Gas usado: ${tx.gasUsed}`, "success");
        await loadInitialData();
        // return tx;
    } catch (error) {
        if (error.receipt) {
            showGasUsed(error.receipt, 'burnGasUsed');
            handleError(error, `Error quemando tokens (Gas usado: ${error.receipt.gasUsed})`);
        } else {
            handleError(error, "Error quemando tokens");
        }
        throw error;
    } finally {
        utils.hideLoader();
    }
}

async function toggleWalletPause(pause) {
    try {
        const method = pause ? 'pauseMyWallet' : 'unpauseMyWallet';
        const estimateElementId = pause ? 'pauseWalletGasEstimate' : 'unpauseWalletGasEstimate';
        const usedElementId = pause ? 'pauseWalletGasUsed' : 'unpauseWalletGasUsed';
        
        const gasEstimate = await estimateTransactionGas(method, [], estimateElementId);
        if (!gasEstimate) return;

        utils.showLoader(pause ? "Pausando wallet..." : "Reanudando wallet...");
        const tx = await contract.methods[method]().send({ 
            from: userAddress,
            gas: Math.floor(gasEstimate * 1.2)
        });
        
        showGasUsed(tx, usedElementId);
        showNotification(
            `Wallet ${pause ? "pausada" : "reanudada"} correctamente! Gas usado: ${tx.gasUsed}`, 
            "success"
        );
        await loadInitialData();
       // return tx;
    } catch (error) {
        if (error.receipt) {
            const usedElementId = pause ? 'pauseWalletGasUsed' : 'unpauseWalletGasUsed';
            showGasUsed(error.receipt, usedElementId);
            handleError(error, `Error ${pause ? "pausando" : "reanudando"} wallet (Gas usado: ${error.receipt.gasUsed})`);
        } else {
            handleError(error, pause ? "Error pausando wallet" : "Error reanudando wallet");
        }
        throw error;
    } finally {
        utils.hideLoader();
    }
}

async function toggleContractPause(pause) {
    if (!isOwner) {
        showNotification("Solo el owner puede pausar el contrato", "error");
        return;
    }
    
    try {
        const method = pause ? 'pause' : 'unpause';
        const estimateElementId = pause ? 'pauseGasEstimate' : 'unpauseGasEstimate';
        const usedElementId = pause ? 'pauseGasUsed' : 'unpauseGasUsed';
        
        const gasEstimate = await estimateTransactionGas(method, [], estimateElementId);
        if (!gasEstimate) return;

        utils.showLoader(pause ? "Pausando contrato..." : "Reanudando contrato...");
        const tx = await contract.methods[method]().send({ 
            from: userAddress,
            gas: Math.floor(gasEstimate * 1.2)
        });

        showGasUsed(tx, usedElementId);
        showNotification(
            `Contrato ${pause ? "pausado" : "reanudado"} correctamente! Gas usado: ${tx.gasUsed}`, 
            "success"
        );
        await loadInitialData();
       // return tx;
    } catch (error) {
        if (error.receipt) {
            const usedElementId = pause ? 'pauseGasUsed' : 'unpauseGasUsed';
            showGasUsed(error.receipt, usedElementId);
            handleError(error, `Error ${pause ? "pausando" : "reanudando"} contrato (Gas usado: ${error.receipt.gasUsed})`);
        } else {
            handleError(error, pause ? "Error pausando contrato" : "Error reanudando contrato");
        }
        throw error;
    } finally {
        utils.hideLoader();
    }
}

async function setAuxiliaryOwner() {
    if (!isOwner) {
        showNotification("Solo el owner puede asignar auxiliar", "error");
        return;
    }
    
    try {
        const newAuxiliary = DOM.newAuxiliary.value;
        validateAddress(newAuxiliary);
        
        const gasEstimate = await estimateTransactionGas(
            'setAuxiliaryOwner',
            [newAuxiliary],
            'auxiliaryGasEstimate'
        );
        
        if (!gasEstimate) return;

        utils.showLoader("Actualizando auxiliar...");
        const tx = await contract.methods.setAuxiliaryOwner(newAuxiliary)
            .send({ 
                from: userAddress,
                gas: Math.floor(gasEstimate * 1.2)
            });
        
        showGasUsed(tx, 'auxiliaryGasUsed');
        showNotification(`Auxiliar actualizado correctamente! Gas usado: ${tx.gasUsed}`, "success");
        await loadInitialData();
        return tx;
    } catch (error) {
        if (error.receipt) {
            showGasUsed(error.receipt, 'auxiliaryGasUsed');
            handleError(error, `Error asignando auxiliar (Gas usado: ${error.receipt.gasUsed})`);
        } else {
            handleError(error, "Error asignando auxiliar");
        }
        throw error;
    } finally {
        utils.hideLoader();
    }
}

async function approveRecovery(approve) {
    if (!isOwner) {
        showNotification("Solo el owner puede aprobar recovery", "error");
        return;
    }
    
    try {
        const gasEstimate = await estimateTransactionGas(
            'approveRecovery',
            [approve],
            'recoveryGasEstimate'
        );
        
        if (!gasEstimate) return;

        utils.showLoader(approve ? "Aprobando recovery..." : "Rechazando recovery...");
        const tx = await contract.methods.approveRecovery(approve)
            .send({ 
                from: userAddress,
                gas: Math.floor(gasEstimate * 1.2)
            });
        
        showGasUsed(tx, 'recoveryGasUsed');
        showNotification(
            `Recovery ${approve ? "aprobado" : "rechazado"} correctamente! Gas usado: ${tx.gasUsed}`, 
            "success"
        );
        await loadInitialData();
     //   return tx;
    } catch (error) {
        if (error.receipt) {
            showGasUsed(error.receipt, 'recoveryGasUsed');
            handleError(error, `Error en aprobación de recovery (Gas usado: ${error.receipt.gasUsed})`);
        } else {
            handleError(error, "Error en aprobación de recovery");
        }
        throw error;
    } finally {
        utils.hideLoader();
    }
}

async function executeRecovery() {
    try {
        const gasEstimate = await estimateTransactionGas(
            'executeRecovery',
            [],
            'recoveryGasEstimate'
        );
        
        if (!gasEstimate) return;

        utils.showLoader("Ejecutando recovery...");
        const tx = await contract.methods.executeRecovery()
            .send({ 
                from: userAddress,
                gas: Math.floor(gasEstimate * 1.2)
            });
        
        showGasUsed(tx, 'recoveryGasUsed');
        showNotification(`¡Ownership transferido exitosamente! Gas usado: ${tx.gasUsed}`, "success");
        await loadInitialData();
      //  return tx;
    } catch (error) {
        if (error.receipt) {
            showGasUsed(error.receipt, 'recoveryGasUsed');
            handleError(error, `Error ejecutando recovery (Gas usado: ${error.receipt.gasUsed})`);
        } else {
            handleError(error, "Error ejecutando recovery");
        }
        throw error;
    } finally {
        utils.hideLoader();
    }
}

async function claimOwnership() {
    if (!isAuxiliary) {
        showNotification("Solo el auxiliar puede iniciar recovery", "error");
        return;
    }
    
    try {
        const gasEstimate = await estimateTransactionGas(
            'claimOwnershipFromAuxiliary',
            [],
            'auxiliaryGasEstimate'
        );
        
        if (!gasEstimate) return;

        utils.showLoader("Iniciando proceso de recovery...");
        const tx = await contract.methods.claimOwnershipFromAuxiliary()
            .send({ 
                from: userAddress,
                gas: Math.floor(gasEstimate * 1.2)
            });
        showGasUsed(tx, 'auxiliaryGasUsed');
        showNotification(`Proceso de recovery iniciado! Gas usado: ${tx.gasUsed}`, "success");
        await loadInitialData();
       // return tx;
    } catch (error) {
        if (error.receipt) {
            showGasUsed(error.receipt, 'auxiliaryGasUsed');
            handleError(error, `Error iniciando recovery (Gas usado: ${error.receipt.gasUsed})`);
        } else {
            handleError(error, "Error iniciando recovery");
        }
        throw error;
    } finally {
        utils.hideLoader();
    }
}

async function estimateApprovalGas() {
    try {
        const spender = DOM.spenderContract.value;
        const amount = DOM.approvalAmount.value;
        
        validateAddress(spender);
        validateAmount(amount);
        
        const isAllowed = await contract.methods.isContractAllowed(spender).call();
        if (!isAllowed) {
            throw new Error("El contrato no está en la lista de permitidos");
        }
        
        const amountInWei = web3.utils.toWei(amount, 'ether');
        const gasEstimate = await estimateTransactionGas(
            'approve',
            [spender, amountInWei],
            'approvalGasEstimate'
        );
        
        if (gasEstimate) {
            showNotification(`Gas estimado: ${gasEstimate}`, "info");
        }
        
        return gasEstimate;
    } catch (error) {
        handleError(error, "Error estimando gas");
        throw error;
    }
}

async function approveTokens() {
    try {
        const spender = DOM.spenderContract.value;
        const amount = DOM.approvalAmount.value;
        
        validateAddress(spender);
        validateAmount(amount);
        
        const isAllowed = await contract.methods.isContractAllowed(spender).call();
        if (!isAllowed) {
            throw new Error("El contrato no está en la lista de permitidos");
        }
        
        const gasEstimate = await estimateApprovalGas();
        if (!gasEstimate) return;

        utils.showLoader("Enviando aprobación...");
        const amountInWei = web3.utils.toWei(amount, 'ether');
        const tx = await contract.methods.approve(spender, amountInWei)
            .send({ 
                from: userAddress,
                gas: Math.floor(gasEstimate * 1.2)
            });
        showGasUsed(tx, 'approvalGasUsed');
        showNotification(`Aprobación exitosa! Gas usado: ${tx.gasUsed}`, "success");
        //return tx;
    } catch (error) {
        if (error.receipt) {
            showGasUsed(error.receipt, 'approvalGasUsed');
            handleError(error, `Error en aprobación (Gas usado: ${error.receipt.gasUsed})`);
        } else {
            handleError(error, "Error en aprobación");
        }
        throw error;
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

function validateAddress(address) {
    if (!web3.utils.isAddress(address)) {
        throw new Error("Dirección inválida");
    }
}

function validateAmount(amount) {
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
        throw new Error("Cantidad inválida");
    }
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

function updateConnectionStatus(status) {
    const statusElement = document.getElementById('networkStatus');
    const statusText = document.getElementById('networkStatusText');
    
    if (!statusElement || !statusText) return;
    
    statusElement.className = 'connection-status-badge ' + status;
    
    switch(status) {
        case 'connected':
            statusText.textContent = shortAddress(userAddress);
            toggleReconnectButton(false);
            break;
        case 'disconnected':
            statusText.textContent = 'Desconectado';
            toggleReconnectButton(true);
            break;
        case 'reconnecting':
            statusText.textContent = 'Reconectando...';
            toggleReconnectButton(false);
            break;
    }
}
async function checkConnection() {
  try {
    await web3.eth.net.isListening();
    return true;
  } catch (error) {
    console.error("Error verificando conexión:", error);
    updateConnectionStatus('disconnected');
    return false;
  }
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
    // Conexión
    if (DOM.connectBtn) {
        DOM.connectBtn.addEventListener('click', connectWallet);
    }
    
    // Desconexión
    if (DOM.disconnectBtn) {
        DOM.disconnectBtn.addEventListener('click', disconnectWallet);
    }

    // Botón de reconexión - Versión mejorada
    const reconnectBtn = document.getElementById('reconnectBtn');
    if (reconnectBtn) {
        reconnectBtn.addEventListener('click', handleReconnect);
    }
    
    // Manejadores de eventos de MetaMask - Versión mejorada
    if (window.ethereum) {
        // Desconexión
        window.ethereum.on('disconnect', (error) => {
            console.warn("Desconexión detectada:", error);
            updateConnectionStatus('disconnected');
            toggleReconnectButton(true);
            showNotification("Conexión perdida. Por favor reconecta.", "error");
        });
        
        // Cambio de red
        window.ethereum.on('chainChanged', (chainId) => {
            console.log("Cadena cambiada:", chainId);
            if (chainId !== AMOY_CONFIG.chainId) {
                showNotification("Red cambiada. Reconectando...", "warning");
            }
            handleReconnect();
        });
        
        // Cuenta cambiada
        window.ethereum.on('accountsChanged', (accounts) => {
            console.log("Cuentas cambiadas:", accounts);
            if (accounts.length === 0) {
                showNotification("Wallet desconectada", "warning");
                updateConnectionStatus('disconnected');
                toggleReconnectButton(true);
            } else {
                handleReconnect();
            }
        });
    }
    
    // Actualizar balance
    if (DOM.refreshBalance) {
        DOM.refreshBalance.addEventListener('click', loadInitialData);
    }
    
    // Copiar direcciones
    if (DOM.copyWalletAddress) {
        DOM.copyWalletAddress.addEventListener('click', () => {
            navigator.clipboard.writeText(userAddress)
                .then(() => showNotification("¡Dirección copiada!", "success"))
                .catch(err => console.error('Error al copiar:', err));
        });
    }
    
    if (DOM.copyContractAddress) {
        DOM.copyContractAddress.addEventListener('click', () => {
            const fullAddress = DOM.contractAddressShort.dataset.fullAddress;
            navigator.clipboard.writeText(fullAddress)
                .then(() => showNotification("¡Contrato copiado!", "success"))
                .catch(err => console.error('Error al copiar:', err));
        });
    }
    
    // Transferencias
    if (DOM.transferBtn) {
        DOM.transferBtn.addEventListener('click', transferTokens);
    }
    
    if (DOM.estimateTransferGas) {
        DOM.estimateTransferGas.addEventListener('click', () => {
            estimateTransactionGas(
                'transfer',
                [DOM.recipientAddress.value, toWei(DOM.transferAmount.value)],
                'transferGasEstimate'
            );
        });
    }
    
    // Mint
    if (DOM.mintBtn) {
        DOM.mintBtn.addEventListener('click', mintTokens);
    }
    
    if (DOM.estimateMintGas) {
        DOM.estimateMintGas.addEventListener('click', () => {
            if (!validateMintInputs()) return;
            estimateTransactionGas(
                'mint',
                [DOM.mintAddress.value, toWei(DOM.mintAmount.value)],
                'mintGasEstimate'
            );
        });
    }
    
    // Funciones de auxiliar
    if (DOM.setAuxiliaryBtn) {
        DOM.setAuxiliaryBtn.addEventListener('click', setAuxiliaryOwner);
    }
    
    if (DOM.claimOwnershipBtn) {
        DOM.claimOwnershipBtn.addEventListener('click', claimOwnership);
    }
    
    // Recovery
    if (DOM.approveRecoveryBtn) {
        DOM.approveRecoveryBtn.addEventListener('click', () => approveRecovery(true));
    }
    
    if (DOM.executeRecoveryBtn) {
        DOM.executeRecoveryBtn.addEventListener('click', executeRecovery);
    }
    
    // Pausas
    if (DOM.pauseWalletBtn) {
        DOM.pauseWalletBtn.addEventListener('click', () => toggleWalletPause(true));
    }
    
    if (DOM.unpauseWalletBtn) {
        DOM.unpauseWalletBtn.addEventListener('click', () => toggleWalletPause(false));
    }
    
    if (DOM.pauseContractBtn) {
        DOM.pauseContractBtn.addEventListener('click', () => toggleContractPause(true));
    }
    
    if (DOM.unpauseContractBtn) {
        DOM.unpauseContractBtn.addEventListener('click', () => toggleContractPause(false));
    }
    
    // Quemar tokens
    if (DOM.burnBtn)
        DOM.burnBtn.addEventListener('click', burnTokens);
    }
    
    // Aprobación de gastos
    if (DOM.estimateApprovalGas) {
        DOM.estimateApprovalGas.addEventListener('click', estimateApprovalGas);
    }
    
    if (DOM.approveTokens) {
        DOM.approveTokens.addEventListener('click', approveTokens);
    }

//****
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
//****
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

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    initApp().catch(handleCSPError);
});
    
    // Seguridad
    if (DOM.pauseWallet) DOM.pauseWallet.addEventListener('click', () => toggleWalletPause(true));
    if (DOM.unpauseWallet) DOM.unpauseWallet.addEventListener('click', () => toggleWalletPause(false));
    
    // Owner functions
    if (DOM.mintTokens) DOM.mintTokens.addEventListener('click', mintTokens);
    if (DOM.estimateMintGas) DOM.estimateMintGas.addEventListener('click', () => 
        estimateTransactionGas(
            'mint',
            [DOM.mintAddress.value, web3.utils.toWei(DOM.mintAmount.value, 'ether')],
            'mintGasEstimate'
        )
    );
    
    if (DOM.pauseContract) DOM.pauseContract.addEventListener('click', () => toggleContractPause(true));
    if (DOM.unpauseContract) DOM.unpauseContract.addEventListener('click', () => toggleContractPause(false));
    
    // Recovery
    if (DOM.approveRecoveryBtn) DOM.approveRecoveryBtn.addEventListener('click', () => approveRecovery(true));
    if (DOM.executeRecoveryBtn) DOM.executeRecoveryBtn.addEventListener('click', executeRecovery);
    
    // Auxiliar
    if (DOM.setAuxiliaryBtn) DOM.setAuxiliaryBtn.addEventListener('click', setAuxiliaryOwner);
    if (DOM.claimOwnershipBtn) DOM.claimOwnershipBtn.addEventListener('click', claimOwnership);
    
    // Aprobación
    if (DOM.estimateApprovalGas) DOM.estimateApprovalGas.addEventListener('click', estimateApprovalGas);
    if (DOM.approveTokens) DOM.approveTokens.addEventListener('click', approveTokens);
}

// Inicialización
if (document.readyState !== 'loading') {
    initApp();
} else {
    document.addEventListener('DOMContentLoaded', initApp);
}
if (window.ethereum) {
    window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
            userAddress = accounts[0];
            updateUI();
            loadInitialData();
        }
    });
    
    window.ethereum.on('chainChanged', () => window.location.reload());
}
