// Firebase config info
const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
  measurementId: ""
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const functions = firebase.functions();

let currentUser = null;
let watchlist = [];
let selectedSymbol = null; // currently selected stock for TradingView

const API_KEY = "";

auth.onAuthStateChanged((user) => {
  if (user) {
    currentUser = user;
    document.getElementById("app").style.display = "block";
    loadUserWatchlist();
    loadAlertHistory();
    setupFormHandlers();
    document.getElementById("logoutBtn").addEventListener("click", () => {
      auth.signOut().then(() => window.location.href = "Login.html")
        .catch(err => console.error("Logout error:", err));
    });
  } else {
    window.location.href = "Login.html";
  }
});

function setupFormHandlers() {
  const stockForm = document.getElementById("stockForm");
  const symbolInput = document.getElementById("symbolInput");
  const thresholdInput = document.getElementById("thresholdInput");

  stockForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const symbol = symbolInput.value.toUpperCase().trim();
    const threshold = parseFloat(thresholdInput.value);
    if (!symbol || isNaN(threshold)) return alert("Please enter a valid stock symbol and alert price.");
    const alertData = { symbol, threshold };
    watchlist.push(alertData);

    if (currentUser) {
      db.collection("users").doc(currentUser.uid).collection("alerts").add(alertData)
        .then(() => console.log(" Alert saved"))
        .catch(err => console.error("Error saving alert:", err));
    }

    selectedSymbol = symbol;            // Set selectedSymbol to new stock
    renderStockList();
    renderWatchlist();
    loadTradingViewWidget(selectedSymbol);  // Load chart for new stock
    symbolInput.value = "";
    thresholdInput.value = "";
  });
}

function renderStockList() {
  const stockList = document.getElementById("stockList");
  stockList.innerHTML = "";

  watchlist.forEach((item) => {
    const stockItem = document.createElement("p");
    stockItem.textContent = item.symbol;
    stockItem.className = "stock-item";
    stockItem.style.cursor = "pointer";
    stockItem.addEventListener("click", () => {
      selectedSymbol = item.symbol;
      renderWatchlist();
      loadTradingViewWidget(selectedSymbol);
    });
    stockList.appendChild(stockItem);
  });

  // On first render, if no selectedSymbol, pick first stock and load it
  if (!selectedSymbol && watchlist.length > 0) {
    selectedSymbol = watchlist[0].symbol;
    renderWatchlist();
    loadTradingViewWidget(selectedSymbol);
  }
}

function renderWatchlist() {
  const watchlistElement = document.getElementById("watchlist");
  const historyBox = document.getElementById("alertHistory");
  watchlistElement.innerHTML = "";

  if (!selectedSymbol) {
    watchlistElement.innerHTML = "<p>No stock selected</p>";
    return;
  }

  // Finds the selected stock data in watchlist
  const item = watchlist.find(w => w.symbol === selectedSymbol);
  if (!item) {
    watchlistElement.innerHTML = "<p>Selected stock not found</p>";
    return;
  }

  const { symbol, threshold } = item;

  fetch(`https://api.twelvedata.com/price?symbol=${symbol}&apikey=${API_KEY}`)
    .then(res => res.json())
    .then(data => {
      const li = document.createElement("li");
      if (data.price) {
        const currentPrice = parseFloat(data.price);
        const up = currentPrice >= threshold;
        li.innerHTML = `
          <div>
            <strong>${symbol}</strong><br/>
            Alert Price: $${threshold.toFixed(2)}<br/>
            Current Price: <span style="color:${up ? 'green' : 'red'};">
              $${currentPrice.toFixed(2)} ${up ? '🔺' : '🔻'}
            </span>
          </div>
          <button data-symbol="${symbol}">❌</button>
        `;

        watchlistElement.appendChild(li);

        if (up && currentUser?.email) {
          const sendEmail = functions.httpsCallable("sendStockAlert");
          sendEmail({ email: currentUser.email, symbol, threshold, currentPrice })
            .then(res => res.data.success ? console.log(` Email sent for ${symbol}`) : console.error(`Email failed for ${symbol}:`, res.data.error))
            .catch(err => console.error("Email function error:", err));

          const historyEntry = {
            symbol,
            threshold,
            currentPrice,
            timestamp: firebase.firestore.Timestamp.fromDate(new Date())
          };

          db.collection("users").doc(currentUser.uid).collection("history").add(historyEntry)
            .then(() => console.log("📘 Alert history saved"))
            .catch(err => console.error("Failed to save history:", err));

          if (historyBox) {
            const entry = document.createElement("p");
            entry.textContent = `${symbol} hit $${currentPrice.toFixed(2)} (alert: $${threshold.toFixed(2)})`;
            historyBox.appendChild(entry);
          }
        }
      } else {
        li.innerHTML = `
          <div>
            <strong>${symbol}</strong><br/>
            Alert Price: $${threshold.toFixed(2)}<br/>
            <span style="color:gray;">Price unavailable</span>
          </div>
          <button data-symbol="${symbol}">❌</button>
        `;
        watchlistElement.appendChild(li);
      }

      attachRemoveEvents();
    })
    .catch(err => console.error(`Error fetching ${symbol}`, err));
}

function attachRemoveEvents() {
  document.querySelectorAll("#watchlist button").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const symbolToRemove = e.target.dataset.symbol;
      const index = watchlist.findIndex(w => w.symbol === symbolToRemove);
      if (index === -1) return;

      watchlist.splice(index, 1);

      if (currentUser) {
        db.collection("users").doc(currentUser.uid).collection("alerts").get()
          .then(snapshot => {
            let docToDelete = null;
            snapshot.forEach(doc => {
              if (doc.data().symbol === symbolToRemove) docToDelete = doc.id;
            });
            if (docToDelete) {
              db.collection("users").doc(currentUser.uid).collection("alerts").doc(docToDelete).delete()
                .then(() => console.log(" Alert deleted"))
                .catch(err => console.error("Error deleting alert:", err));
            }
          });
      }

      // Update selectedSymbol if needed
      if (selectedSymbol === symbolToRemove) {
        selectedSymbol = watchlist.length > 0 ? watchlist[0].symbol : null;
        if (selectedSymbol) {
          loadTradingViewWidget(selectedSymbol);
        } else {
          document.getElementById("tradingviewChart").innerHTML = "";
        }
      }

      renderStockList();
      renderWatchlist();
    });
  });
}

// Load TradingView widget for selected stock
function loadTradingViewWidget(symbol) {
  const container = document.getElementById("tradingviewChart");
  if (!container) return;
  container.innerHTML = ""; // Clear previous

  new TradingView.widget({
    width: container.offsetWidth,
    height: container.offsetHeight || 400,
    symbol: symbol,
    interval: "D",
    timezone: "Etc/UTC",
    theme: "dark",
    style: "1",
    locale: "en",
    toolbar_bg: "#0e1117",
    enable_publishing: false,
    allow_symbol_change: false,
    container_id: "tradingviewChart"
  });
}

function loadUserWatchlist() {
  if (!currentUser) return;

  db.collection("users").doc(currentUser.uid).collection("alerts").get()
    .then(snapshot => {
      watchlist = [];
      snapshot.forEach(doc => watchlist.push(doc.data()));
      renderStockList();
      renderWatchlist();
    })
    .catch(err => console.error("Failed to load watchlist:", err));
}

function loadAlertHistory() {
  const historyBox = document.getElementById("alertHistory");
  if (!currentUser || !historyBox) return;

  db.collection("users").doc(currentUser.uid).collection("history")
    .orderBy("timestamp", "desc").limit(20).get()
    .then(snapshot => {
      snapshot.forEach(doc => {
        const { symbol, currentPrice, threshold, timestamp } = doc.data();
        const time = timestamp.toDate().toLocaleString();
        const entry = document.createElement("p");
        entry.textContent = `${symbol} hit $${currentPrice.toFixed(2)} (alert: $${threshold.toFixed(2)}) at ${time}`;
        historyBox.appendChild(entry);
      });
    })
    .catch(err => console.error("Failed to load history:", err));
}





