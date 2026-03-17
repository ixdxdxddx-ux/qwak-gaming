import React, { useState } from 'react';
import './GameLibrary.css';

export default function GameLibrary() {
  const [hoveredCard, setHoveredCard] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const games = [
    { id: 1, title: 'Cosmic Drift', category: 'action', image: '🌌' },
    { id: 2, title: 'Pixel Quest', category: 'adventure', image: '🗺️' },
    { id: 3, title: 'Puzzle Master', category: 'puzzle', image: '🧩' },
    { id: 4, title: 'Strategy Wars', category: 'strategy', image: '♟️' },
    { id: 5, title: 'Racing Pro', category: 'action', image: '🏁' },
    { id: 6, title: 'Mystery Box', category: 'puzzle', image: '🎭' },
  ];

  const filteredGames = selectedCategory === 'all' 
    ? games 
    : games.filter(g => g.category === selectedCategory);

  const categories = [
    { value: 'all', label: 'All games' },
    { value: 'action', label: 'Action' },
    { value: 'adventure', label: 'Adventure' },
    { value: 'puzzle', label: 'Puzzle' },
    { value: 'strategy', label: 'Strategy' },
  ];

  return (
    <div className="library-container">
      <div className="header-section">
        <div>
          <h1 className="header-title">Recently added</h1>
          <p className="header-subtitle">Explore your new games</p>
        </div>
        <button className="btn btn-secondary">View all</button>
      </div>

      <div className="filters-container">
        {categories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setSelectedCategory(cat.value)}
            className={`btn btn-filter ${selectedCategory === cat.value ? 'active' : ''}`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="games-grid">
        {filteredGames.map((game) => (
          <div
            key={game.id}
            className="game-card"
            onMouseEnter={() => setHoveredCard(game.id)}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div className="game-image">{game.image}</div>
            
            <div className="game-info">
              <h3 className="game-title">{game.title}</h3>
              
              <button 
                className={`btn btn-play ${hoveredCard === game.id ? 'active' : ''}`}
              >
                Play
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredGames.length === 0 && (
        <div className="empty-state">
          <p>No games in this category</p>
        </div>
      )}
    </div>
  );
}
