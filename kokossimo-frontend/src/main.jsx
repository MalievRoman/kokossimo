import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { CartProvider } from './context/CartContext'
import { FavoritesProvider } from './context/FavoritesContext'
import { CatalogFiltersProvider } from './context/CatalogFiltersContext'
import App from './App.jsx'
import './index.css'
import './styles/koko-main.css'

const baseUrl = import.meta.env.BASE_URL || '/'
const setIconVar = (name, file) => {
  document.documentElement.style.setProperty(name, `url("${baseUrl}assets/${file}")`)
}
setIconVar('--icon-catalog', 'header__catalog-icon.svg')
setIconVar('--icon-search', 'header__search-icon.svg')
setIconVar('--icon-cart', 'cart-icon.svg')
setIconVar('--icon-fav', 'fav-icon.svg')
setIconVar('--icon-profile', 'profile-icon.svg')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <CartProvider>
        <FavoritesProvider>
          <CatalogFiltersProvider>
            <App />
          </CatalogFiltersProvider>
        </FavoritesProvider>
      </CartProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
