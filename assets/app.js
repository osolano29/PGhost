// ================ CONFIGURACIÓN ================
// Importamos el ABI y dirección del contrato desde el JSON
import GhostToken from './contracts/GhostToken.json';

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

// Inicialización mejorada con detección robusta de MetaMask
export async function initWeb3() {
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
        contract = new web3.eth.Contract(GhostToken.abi, GhostToken.networks["80002"].address);
        
        // 5. Cargar datos iniciales
        await loadInitialData();
        
        console.log("Conexión exitosa con:", userAddress);
        return true;
        
    } catch (error) {
        handleConnectionError(error);
        return false;
    }
}

// ================ FUNCIONES AUXILIARES ================

function detectMetaMask() {
    if (window.ethereum) {
        if (window.ethereum.providers) {
            return window.ethereum.providers.find(p => p.isMetaMask) || window.ethereum;
        }
        return window.ethereum;
    }
    
    if (window.web3 && window.web3.currentProvider && window.web3.currentProvider.isMetaMask) {
        return window.web3.currentProvider;
    }
    
    return null;
}

async function connectAccounts(provider) {
    try {
        return await provider.request({ method: 'eth_requestAccounts' });
    } catch (error) {
        console.log("Método moderno falló, intentando método legacy...");
        try {
            return await web3.eth.getAccounts();
        } catch (legacyError) {
            throw new Error("No se pudo conectar a las cuentas");
        }
    }
}

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

// ================ FUNCIONES DEL CONTRATO ================

// Funciones de lectura
export async function getBalance() {
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

export async function getTotalSupply() {
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

// Funciones de escritura
export async function transferTokens() {
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

// ================ UTILIDADES ================

function showLoader() {
    document.getElementById('loader').style.display = 'flex';
}

function hideLoader() {
    document.getElementById('loader').style.display = 'none';
}

function updateUI() {
    document.getElementById('walletAddress').textContent = shortAddress(userAddress);
    document.getElementById('network').textContent = "Polygon Amoy Testnet";
}

function shortAddress(address) {
    return address ? `${address.substring(0, 6)}...${address.substring(38)}` : "N/A";
}

function getUserFriendlyError(error) {
    if (error.message.includes("user denied transaction")) {
        return "Transacción cancelada por el usuario";
    }
    if (error.message.includes("insufficient funds")) {
        return "Fondos insuficientes para gas";
    }
    return error.message.split("(")[0].trim() || "Error desconocido";
}

// ================ INICIALIZACIÓN ================

// Asignación de event listeners
function setupEventListeners() {
    document.getElementById('connectWallet').addEventListener('click', initWeb3);
    document.getElementById('transferTokens').addEventListener('click', transferTokens);
    document.getElementById('getBalance').addEventListener('click', getBalance);
    // Agrega más listeners según necesites
}

// Inicialización cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    
    // Intento de conexión automática si ya está conectado
    if (window.ethereum && window.ethereum.selectedAddress) {
        initWeb3();
    }
});

// Escuchar cambios de cuenta/red
if (window.ethereum) {
    window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
            userAddress = accounts[0];
            updateUI();
            loadInitialData();
        }
    });

    window.ethereum.on('chainChanged', () => {
        window.location.reload();
    });
}
