# Stock-watchlist-alert-app
A web-based stock tracking app using Firebase, TradingView, and Twelve Data API to monitor prices, set alerts, and view real-time charts.

## Technologies Used

- **HTML, CSS, JavaScript** – Frontend interface
- **Firebase Authentication** – User login and authentication
- **Firebase Firestore** – Real-time database for watchlist and history
- **Firebase Cloud Functions** – Email notifications for price alerts
- **Twelve Data API** – Real-time stock prices
- **TradingView Widget** – Interactive stock chart embeds

## Features

-  User login and logout with Firebase Auth  
-  Add stocks and set alert thresholds  
-  Real-time price checking via Twelve Data  
-  Live charts with TradingView  
-  Email notifications when a stock hits the alert price  
-  Alert history tracking in Firestore  
-  Clean UI with categorized stock list, watchlist, and history panels

## How it works

1. **User logs in** using Firebase Authentication.  
2. **Adds a stock symbol** and sets a price alert.  
3. The app **fetches current stock prices** periodically using the Twelve Data API.  
4. When the stock hits the alert price:
   - An **email alert is sent** via Firebase Cloud Functions.
   - The event is **recorded in the alert history**.
   - The chart updates to show real-time data via TradingView.

## Setup

1. Clone the repo
2. Run `npm install` inside `/functions` for Firebase Functions
3. Add a `.env` file with your API keys
4. Deploy with Firebase CLI
