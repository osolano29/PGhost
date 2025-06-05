// ================ CONFIGURACIÓN ================
// Importación del ABI (si usas módulos)
import GhostTokenABI from './contracts/GhostToken.json';

// Configuración de Polygon Amoy
const AMOY_CONFIG = {
    chainId: '0x13882', // 80002 en hexadecimal
    chainName: 'Polygon Amoy Testnet',
    nativeCurrency: {
        name: 'MATIC',
        symbol: 'MATIC',
        decimals: 18
    },
    rpcUrls: ['https://rpc-amoy.polygon.technology/'],
    blockExplorerUrls: ['https://amoy.polygonscan.com/']
};

// Variables globales
let web3;
let contract;
let userAddress;
let isOwner = false;
let isAuxiliary = false;

// ================ FUNCIONES PRINCIPALES ================

// Solución temporal para el warning de postMessage
if (window.location.protocol === 'file:') {
    console.warn('Ejecutando en modo local - Algunas funciones pueden estar limitadas');
    window.origin = 'file://';
}

// Inicialización mejorada con detección robusta de MetaMask
async function initWeb3() {
    // 1. Detección mejorada para todas las versiones de MetaMask
    const ethereumProvider = detectMetaMask();
    
    if (!ethereumProvider) {
        showMetaMaskModal();
        return false;
    }

    try {
        // 2. Configurar Web3
        web3 = new Web3(ethereumProvider);
        
        // 3. Conectar cuentas
        const accounts = await connectAccounts(ethereumProvider);
        if (!accounts || accounts.length === 0) {
            throw new Error("No se obtuvieron cuentas");
        }

        userAddress = accounts[0];
        updateUI(); // Actualizar UI inmediatamente

        // 4. Configurar red y contrato
        await setupNetwork();
        contract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
        
        // 5. Cargar datos iniciales
        await loadInitialData();
        
        console.log("Conexión exitosa con:", userAddress);
        return true;
        
    } catch (error) {
        handleConnectionError(error);
        return false;
    }
}

// Función para detectar MetaMask de manera robusta
function detectMetaMask() {
    // Para MetaMask moderno
    if (window.ethereum) {
        // Manejar múltiples proveedores
        if (window.ethereum.providers) {
            return window.ethereum.providers.find(p => p.isMetaMask) || window.ethereum;
        }
        return window.ethereum;
    }
    
    // Para versiones antiguas de MetaMask
    if (window.web3 && window.web3.currentProvider && window.web3.currentProvider.isMetaMask) {
        return window.web3.currentProvider;
    }
    
    return null;
}

// Conexión de cuentas con manejo de errores
async function connectAccounts(provider) {
    try {
        // Intento con el método moderno primero
        return await provider.request({ method: 'eth_requestAccounts' });
    } catch (error) {
        console.log("Método moderno falló, intentando método legacy...");
        try {
            // Fallback para versiones antiguas
            return await web3.eth.getAccounts();
        } catch (legacyError) {
            throw new Error("No se pudo conectar a las cuentas");
        }
    }
}

// Configurar la red Polygon Amoy
async function setupNetwork() {
    try {
        const chainId = await web3.eth.getChainId();
        
        if (chainId !== 80002) {
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: AMOY_CONFIG.chainId }]
                });
            } catch (switchError) {
                // Si la red no está agregada, intentar añadirla
                if (switchError.code === 4902) {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [AMOY_CONFIG]
                    });
                } else {
                    throw new Error("Por favor cambia manualmente a Polygon Amoy");
                }
            }
        }
    } catch (error) {
        console.error("Error configurando red:", error);
        throw new Error("Error configurando la red");
    }
}

// Cargar datos iniciales del contrato
async function loadInitialData() {
    try {
        await Promise.all([
            checkRoles(),
            updateContractStatus(),
            getTotalSupply(),
            getBalance(),
            getAuxiliaryOwner(),
            getRecoveryStatus()
        ]);
    } catch (error) {
        console.error("Error cargando datos iniciales:", error);
    }
}

// ================ FUNCIONES DEL CONTRATO ================

// ----- Funciones de Lectura -----
async function checkRoles() {
    try {
        const [owner, auxiliary] = await Promise.all([
            contract.methods.owner().call(),
            contract.methods.auxiliaryOwner().call()
        ]);
        
        isOwner = userAddress.toLowerCase() === owner.toLowerCase();
        isAuxiliary = userAddress.toLowerCase() === auxiliary.toLowerCase();
        
        // Mostrar secciones según privilegios
        document.getElementById('ownerSection').style.display = isOwner ? 'block' : 'none';
        document.getElementById('auxiliarySection').style.display = isAuxiliary ? 'block' : 'none';
        document.getElementById('contractControls').style.display = isOwner ? 'block' : 'none';
        
        return { isOwner, isAuxiliary };
    } catch (error) {
        console.error("Error verificando roles:", error);
        return { isOwner: false, isAuxiliary: false };
    }
}

async function getBalance() {
    try {
        const balance = await contract.methods.balanceOf(userAddress).call();
        const formattedBalance = web3.utils.fromWei(balance, 'ether');
        document.getElementById('tokenBalance').textContent = `${formattedBalance} GO`;
        return formattedBalance;
    } catch (error) {
        console.error("Error obteniendo balance:", error);
        document.getElementById('tokenBalance').textContent = "Error";
        return "0";
    }
}

async function getTotalSupply() {
    try {
        const supply = await contract.methods.totalSupply().call();
        const formattedSupply = web3.utils.fromWei(supply, 'ether');
        document.getElementById('totalSupply').textContent = `${formattedSupply} GO`;
        return formattedSupply;
    } catch (error) {
        console.error("Error obteniendo suministro:", error);
        document.getElementById('totalSupply').textContent = "Error";
        return "0";
    }
}

async function updateContractStatus() {
    try {
        const [isPaused, isWalletPaused] = await Promise.all([
            contract.methods.paused().call(),
            contract.methods.isWalletPaused(userAddress).call()
        ]);
        
        document.getElementById('contractPausedStatus').textContent = 
            isPaused ? '⛔ PAUSADO' : '✅ Activo';
        document.getElementById('walletPausedStatus').textContent = 
            isWalletPaused ? '⛔ PAUSADA' : '✅ Activa';
            
        return { isPaused, isWalletPaused };
    } catch (error) {
        console.error("Error obteniendo estado:", error);
        return { isPaused: false, isWalletPaused: false };
    }
}

// ----- Funciones de Escritura -----
async function transferTokens() {
    const recipient = document.getElementById('recipientAddress').value;
    const amount = document.getElementById('transferAmount').value;
    
    if (!web3.utils.isAddress(recipient)) {
        alert("Dirección inválida");
        return;
    }
    
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
        alert("Cantidad inválida");
        return;
    }

    try {
        showLoader();
        const amountInWei = web3.utils.toWei(amount, 'ether');
        await contract.methods.transfer(recipient, amountInWei)
            .send({ from: userAddress });
        
        alert("Transferencia exitosa!");
        await getBalance();
    } catch (error) {
        console.error("Error en transferencia:", error);
        alert(`Error: ${getUserFriendlyError(error)}`);
    } finally {
        hideLoader();
    }
}

async function mintTokens() {
    if (!isOwner) return;
    
    const recipient = document.getElementById('mintAddress').value;
    const amount = document.getElementById('mintAmount').value;
    
    if (!web3.utils.isAddress(recipient)) {
        alert("Dirección inválida");
        return;
    }
    
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
        alert("Cantidad inválida");
        return;
    }

    try {
        showLoader();
        const amountInWei = web3.utils.toWei(amount, 'ether');
        await contract.methods.mint(recipient, amountInWei)
            .send({ from: userAddress });
        
        alert("Tokens minteados exitosamente!");
        await Promise.all([getTotalSupply(), getBalance()]);
    } catch (error) {
        console.error("Error minteando tokens:", error);
        alert(`Error: ${getUserFriendlyError(error)}`);
    } finally {
        hideLoader();
    }
}
// ============ SISTEMA DE OWNERSHIP ============
async function setAuxiliaryOwner() {
    if (!isOwner) {
        alert("Solo el owner puede asignar un auxiliar");
        return;
    }

    const newAuxiliary = document.getElementById('newAuxiliary').value;
    
    if (!web3.utils.isAddress(newAuxiliary)) {
        alert("Dirección inválida");
        return;
    }

    try {
        showLoader();
        await contract.methods.setAuxiliaryOwner(newAuxiliary)
            .send({ from: userAddress });
        alert("Auxiliar actualizado correctamente");
        await getAuxiliaryOwner();
    } catch (error) {
        console.error("Error al asignar auxiliar:", error);
        alert(`Error: ${getUserFriendlyError(error)}`);
    } finally {
        hideLoader();
    }
}

async function getAuxiliaryOwner() {
    try {
        const auxiliary = await contract.methods.auxiliaryOwner().call();
        const auxiliaryDisplay = auxiliary === '0x0000000000000000000000000000000000000000' ? 
            'No asignado' : shortAddress(auxiliary);
        document.getElementById('auxiliaryAddress').textContent = auxiliaryDisplay;
        return auxiliary;
    } catch (error) {
        console.error("Error obteniendo auxiliar:", error);
        return null;
    }
}

async function claimOwnership() {
    if (!isAuxiliary) {
        alert("Solo el auxiliar puede reclamar ownership");
        return;
    }

    try {
        showLoader();
        await contract.methods.claimOwnershipFromAuxiliary()
            .send({ from: userAddress });
        alert("Proceso de recovery iniciado. Espera 7 días.");
        await getRecoveryStatus();
    } catch (error) {
        console.error("Error reclamando ownership:", error);
        alert(`Error: ${getUserFriendlyError(error)}`);
    } finally {
        hideLoader();
    }
}

async function approveRecovery() {
    if (!isOwner) {
        alert("Solo el owner puede aprobar recovery");
        return;
    }

    const shouldApprove = confirm("¿Aprobar la transferencia de ownership al nominado?");
    
    try {
        showLoader();
        await contract.methods.approveRecovery(shouldApprove)
            .send({ from: userAddress });
        alert(shouldApprove ? "Recovery aprobado" : "Recovery rechazado");
        await getRecoveryStatus();
    } catch (error) {
        console.error("Error aprobando recovery:", error);
        alert(`Error: ${getUserFriendlyError(error)}`);
    } finally {
        hideLoader();
    }
}

async function executeRecovery() {
    try {
        showLoader();
        await contract.methods.executeRecovery()
            .send({ from: userAddress });
        alert("¡Ownership transferido exitosamente!");
        await loadInitialData(); // Recargar todos los datos
    } catch (error) {
        console.error("Error ejecutando recovery:", error);
        alert(`Error: ${getUserFriendlyError(error)}`);
    } finally {
        hideLoader();
    }
}

async function getRecoveryStatus() {
    try {
        const [nominee, deadline, approved] = await contract.methods.recoveryStatus().call();
        
        document.getElementById('recoveryNominee').textContent = 
            nominee === '0x0000000000000000000000000000000000000000' ? 
            'Ninguno' : shortAddress(nominee);
            
        document.getElementById('recoveryDeadline').textContent = 
            deadline === '0' ? 'N/A' : new Date(deadline * 1000).toLocaleString();
            
        document.getElementById('recoveryApproved').textContent = 
            approved ? '✅ Aprobado' : '❌ No aprobado';
            
        return { nominee, deadline, approved };
    } catch (error) {
        console.error("Error obteniendo estado de recovery:", error);
        return { nominee: null, deadline: 0, approved: false };
    }
}


// ================ UTILIDADES ================

// Mostrar/ocultar loader
function showLoader() {
    document.getElementById('loader').style.display = 'block';
}

function hideLoader() {
    document.getElementById('loader').style.display = 'none';
}

// Manejo de errores amigable
function getUserFriendlyError(error) {
    if (error.message.includes("user denied transaction")) {
        return "Transacción cancelada por el usuario";
    }
    if (error.message.includes("insufficient funds")) {
        return "Fondos insuficientes para gas";
    }
    if (error.message.includes("execution reverted")) {
        return "Operación revertida por el contrato";
    }
    return error.message.split("(")[0].trim() || "Error desconocido";
}

// Formatear dirección
function shortAddress(address) {
    return address ? `${address.substring(0, 6)}...${address.substring(38)}` : "N/A";
}

// Actualizar UI
function updateUI() {
    document.getElementById('walletAddress').textContent = shortAddress(userAddress);
    document.getElementById('network').textContent = "Polygon Amoy Testnet";
}

// Mostrar modal de instalación de MetaMask
function showMetaMaskModal() {
    const shouldInstall = confirm(
        "MetaMask no detectado. ¿Quieres ir a la página de instalación?\n\n" +
        "Si ya lo tienes instalado, prueba:\n" +
        "1. Actualizar MetaMask\n" +
        "2. Reiniciar el navegador\n" +
        "3. Verificar que la extensión esté activada"
    );
    
    if (shouldInstall) {
        window.open("https://metamask.io/download.html", "_blank");
    }
}

// Manejo de errores de conexión
function handleConnectionError(error) {
    console.error("Error de conexión:", error);
    
    let errorMessage = "Error desconocido";
    if (error.code === 4001) {
        errorMessage = "Cancelaste la conexión";
    } else if (error.message.includes("Already processing eth_requestAccounts")) {
        errorMessage = "Por favor desbloquea MetaMask primero";
    } else {
        errorMessage = error.message.split("(")[0].trim();
    }
    
    alert(`Error de conexión: ${errorMessage}`);
}

// ================ EVENT LISTENERS ================
document.addEventListener('DOMContentLoaded', () => {
    // Conexión
    document.getElementById('connectWallet').addEventListener('click', initWeb3);
    
    // Token
    document.getElementById('transferTokens').addEventListener('click', transferTokens);
    document.getElementById('burnTokens').addEventListener('click', burnTokens);
    document.getElementById('mintTokens').addEventListener('click', mintTokens);
    
    // Seguridad
    document.getElementById('pauseWallet').addEventListener('click', () => toggleWalletPause('pause'));
    document.getElementById('unpauseWallet').addEventListener('click', () => toggleWalletPause('unpause'));
    document.getElementById('pauseContract').addEventListener('click', () => toggleContractPause('pause'));
    document.getElementById('unpauseContract').addEventListener('click', () => toggleContractPause('unpause'));
    
    // Ownership
    document.getElementById('setAuxiliaryBtn').addEventListener('click', setAuxiliaryOwner);
    document.getElementById('claimOwnershipBtn').addEventListener('click', claimOwnership);
    document.getElementById('approveRecoveryBtn').addEventListener('click', approveRecovery);
    document.getElementById('executeRecoveryBtn').addEventListener('click', executeRecovery);
    
    // Whitelist
    document.getElementById('toggleAllowanceBtn').addEventListener('click', toggleContractAllowance);
});

// Escuchar cambios de cuenta/red
if (window.ethereum) {
    window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
            userAddress = accounts[0];
            updateUI();
            loadInitialData();
        } else {
            alert("Por favor reconecta tu wallet");
        }
    });

    window.ethereum.on('chainChanged', () => {
        window.location.reload();
    });
}

// Intento de conexión automática al cargar
window.addEventListener('load', async () => {
    if (window.ethereum && window.ethereum.selectedAddress) {
        await initWeb3();
    }
});
