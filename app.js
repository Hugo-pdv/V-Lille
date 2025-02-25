document.addEventListener('DOMContentLoaded', () => {
    // Constantes et utilitaires
    const STATION_COLORS = {
        INACTIVE: '#808080',
        EMPTY: '#f44336',
        FEW: '#FFA500',
        AVAILABLE: '#4CAF50'
    };
    
    const FILTER_CONFIG = [
        { id: 'available', color: STATION_COLORS.AVAILABLE, label: 'Disponible' },
        { id: 'few', color: STATION_COLORS.FEW, label: 'Peu de vélos' },
        { id: 'empty', color: STATION_COLORS.EMPTY, label: 'Aucun vélo' },
        { id: 'inactive', color: STATION_COLORS.INACTIVE, label: 'Hors service' }
    ];
    
    const isMobile = () => window.innerWidth <= 768;
    
    const getStationColor = (station) => {
        if (station.etat !== 'EN SERVICE') return STATION_COLORS.INACTIVE;
        if (station.nb_velos_dispo === 0) return STATION_COLORS.EMPTY;
        if (station.nb_velos_dispo < 5) return STATION_COLORS.FEW;
        return STATION_COLORS.AVAILABLE;
    };

    // Initialisation de la carte
    const map = L.map('map', {
        zoomControl: false,
        tap: true,
        touchZoom: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors, © CARTO',
        maxZoom: 19
    }).addTo(map);

    // Création des filtres
    const createFilterControl = () => {
        const filters = L.control({ position: 'topleft' });
        
        filters.onAdd = () => {
            const div = L.DomUtil.create('div', 'info filters');
            
            div.innerHTML = `
                <div class="filters-title">Filtres</div>
                ${FILTER_CONFIG.map(filter => `
                    <div class="filter-item">
                        <input type="checkbox" id="filter-${filter.id}" checked>
                        <label for="filter-${filter.id}">
                            <span class="filter-color" style="background: ${filter.color}"></span>
                            ${filter.label}
                        </label>
                    </div>
                `).join('')}
            `;

            div.addEventListener('mousedown', e => e.stopPropagation());
            return div;
        };

        return filters;
    };

    createFilterControl().addTo(map);

    // Gestion des stations
    const createStationPopup = (station) => {
        return `
            <div class="custom-popup">
                <h3>${station.nom}</h3>
                <p class="address">${station.adresse}</p>
                <div class="stats">
                    <div class="stat-item">
                        <span class="stat-value">${station.nb_velos_dispo}</span>
                        <span class="stat-label">Vélos</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${station.nb_places_dispo}</span>
                        <span class="stat-label">Places</span>
                    </div>
                </div>
                <div class="status ${station.etat === 'EN SERVICE' ? 'active' : 'inactive'}">
                    ${station.etat}
                </div>
                <div class="update-time">
                    Mise à jour : ${new Date(station.date_modification).toLocaleString()}
                </div>
            </div>
        `;
    };

    const shouldDisplayStation = (station) => {
        if (station.etat !== 'EN SERVICE') {
            return document.getElementById('filter-inactive').checked;
        }
        
        if (station.nb_velos_dispo === 0) {
            return document.getElementById('filter-empty').checked;
        }
        
        if (station.nb_velos_dispo < 5) {
            return document.getElementById('filter-few').checked;
        }
        
        return document.getElementById('filter-available').checked;
    };

    const createStationMarker = (station) => {
        const marker = L.circleMarker([station.y, station.x], {
            radius: isMobile() ? 8 : 10,
            fillColor: getStationColor(station),
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        });

        marker.bindPopup(createStationPopup(station), {
            autoPan: true,
            autoPanPadding: [10, 10],
            maxWidth: isMobile() ? 280 : 300
        });

        return marker;
    };

    // Chargement des données
    async function fetchStations() {
        try {
            const response = await fetch('data.json');
            return (await response.json()).velos;
        } catch (error) {
            console.error('Erreur lors du chargement des données:', error);
            return [];
        }
    }

    async function loadStations() {
        // Supprimer les marqueurs existants
        map.eachLayer(layer => {
            if (layer instanceof L.CircleMarker) map.removeLayer(layer);
        });

        const stations = await fetchStations();
        
        stations
            .filter(shouldDisplayStation)
            .forEach(station => createStationMarker(station).addTo(map));
    }

    // Initialisation
    async function initMap() {
        try {
            const stations = await fetchStations();
            
            if (stations.length > 0) {
                const bounds = L.latLngBounds(stations.map(s => [s.y, s.x]));
                map.fitBounds(bounds, {
                    padding: [50, 50],
                    maxZoom: 13
                });
            } else {
                // Position par défaut (Lille)
                map.setView([50.63297, 3.057520], 13);
            }
        } catch (error) {
            console.error('Erreur lors de l\'initialisation:', error);
            map.setView([50.63297, 3.057520], 13);
        }
    }

    // Démarrage de l'application
    initMap().then(() => {
        loadStations();
        setInterval(loadStations, 30000);
        
        if (isMobile()) {
            map.on('click', () => map.closePopup());
        }
    });

    // Gestion des événements
    FILTER_CONFIG.forEach(filter => {
        document.getElementById(`filter-${filter.id}`).addEventListener('change', loadStations);
    });

    // Gestion du redimensionnement
    let previousIsMobile = isMobile();
    window.addEventListener('resize', () => {
        const currentIsMobile = isMobile();
        if (previousIsMobile !== currentIsMobile) {
            previousIsMobile = currentIsMobile;
            location.reload();
        }
    });
});