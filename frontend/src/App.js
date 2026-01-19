import React, { useState } from 'react';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('find');
  const [plateNumber, setPlateNumber] = useState('');
  const [carLocation, setCarLocation] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Park car simulation
  const [parkFloor, setParkFloor] = useState('1');
  const [parkSpot, setParkSpot] = useState('A1');
  const [parkPlate, setParkPlate] = useState('');
  const [parkSuccess, setParkSuccess] = useState(false);

  const API_URL = 'http://localhost:3000';

  // Get current time
  const [currentTime, setCurrentTime] = useState(new Date());
  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const findCar = async (e) => {
    e.preventDefault();
    setError('');
    setCarLocation(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/find/${plateNumber.toUpperCase()}`);
      const data = await response.json();

      if (data.success) {
        setCarLocation(data.data);
      } else {
        setError(data.error || 'Car not found');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const simulatePark = async (e) => {
    e.preventDefault();
    setError('');
    setParkSuccess(false);
    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/simulate-detection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plate: parkPlate.toUpperCase(),
          floor: parseInt(parkFloor),
          spot: parkSpot.toUpperCase(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setParkSuccess(true);
        setParkPlate('');
      } else {
        setError(data.error || 'Failed to park car');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="kiosk-container">
      <div className="kiosk-screen">
        {/* Header Bar */}
        <div className="kiosk-header">
          <div className="header-left">
            <div className="parking-logo">🅿️</div>
            <div className="header-info">
              <h1>SMART PARKING</h1>
              <p>Gateway Plaza Parking Structure</p>
            </div>
          </div>
          <div className="header-right">
            <div className="datetime">
              <div className="time">{currentTime.toLocaleTimeString()}</div>
              <div className="date">{currentTime.toLocaleDateString()}</div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="kiosk-content">
          {/* Navigation Tabs */}
          <div className="kiosk-tabs">
            <button
              className={activeTab === 'find' ? 'kiosk-tab active' : 'kiosk-tab'}
              onClick={() => {
                setActiveTab('find');
                setError('');
                setCarLocation(null);
                setParkSuccess(false);
              }}
            >
              <span className="tab-icon">🔍</span>
              <span className="tab-text">Find My Vehicle</span>
            </button>
            <button
              className={activeTab === 'park' ? 'kiosk-tab active' : 'kiosk-tab'}
              onClick={() => {
                setActiveTab('park');
                setError('');
                setCarLocation(null);
                setParkSuccess(false);
              }}
            >
              <span className="tab-icon">🅿️</span>
              <span className="tab-text">Check In Vehicle</span>
            </button>
          </div>

          {/* Content Area */}
          <div className="kiosk-main">
            {activeTab === 'find' && (
              <div className="kiosk-card">
                <div className="card-header">
                  <h2>🚗 Locate Your Vehicle</h2>
                  <p>Enter your license plate number to find your parking location</p>
                </div>

                <form onSubmit={findCar} className="kiosk-form">
                  <div className="input-group">
                    <label>LICENSE PLATE NUMBER</label>
                    <input
                      type="text"
                      value={plateNumber}
                      onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                      placeholder="ABC1234"
                      required
                      className="kiosk-input"
                      maxLength="10"
                    />
                  </div>
                  <button type="submit" className="kiosk-button primary" disabled={loading}>
                    {loading ? (
                      <>
                        <span className="spinner"></span> Searching...
                      </>
                    ) : (
                      <>
                        <span className="button-icon">🔍</span> FIND VEHICLE
                      </>
                    )}
                  </button>
                </form>

                {error && (
                  <div className="kiosk-alert error">
                    <span className="alert-icon">⚠️</span>
                    <div>
                      <strong>Vehicle Not Found</strong>
                      <p>{error}</p>
                    </div>
                  </div>
                )}

                {carLocation && (
                  <div className="location-display">
                    <div className="location-header">
                      <span className="success-badge">✓ VEHICLE LOCATED</span>
                    </div>
                    <div className="location-grid">
                      <div className="location-item floor">
                        <div className="location-label">FLOOR</div>
                        <div className="location-value">{carLocation.floor}</div>
                      </div>
                      <div className="location-item spot">
                        <div className="location-label">PARKING SPOT</div>
                        <div className="location-value">{carLocation.spot}</div>
                      </div>
                    </div>
                    <div className="location-details">
                      <div className="detail-row">
                        <span>License Plate:</span>
                        <strong>{carLocation.plate}</strong>
                      </div>
                      <div className="detail-row">
                        <span>Parked Since:</span>
                        <strong>{new Date(carLocation.parked_at).toLocaleString()}</strong>
                      </div>
                    </div>
                    <div className="location-footer">
                      <p>🚶 Follow the signs to Floor {carLocation.floor}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'park' && (
              <div className="kiosk-card">
                <div className="card-header">
                  <h2>🅿️ Check In Your Vehicle</h2>
                  <p>Simulation: In a real system, cameras detect this automatically</p>
                </div>

                <form onSubmit={simulatePark} className="kiosk-form">
                  <div className="input-group">
                    <label>LICENSE PLATE NUMBER</label>
                    <input
                      type="text"
                      value={parkPlate}
                      onChange={(e) => setParkPlate(e.target.value.toUpperCase())}
                      placeholder="ABC1234"
                      required
                      className="kiosk-input"
                      maxLength="10"
                    />
                  </div>
                  <div className="input-row">
                    <div className="input-group half">
                      <label>FLOOR</label>
                      <select
                        value={parkFloor}
                        onChange={(e) => setParkFloor(e.target.value)}
                        className="kiosk-select"
                      >
                        {[1, 2, 3, 4, 5].map((floor) => (
                          <option key={floor} value={floor}>
                            Floor {floor}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="input-group half">
                      <label>SPOT</label>
                      <input
                        type="text"
                        value={parkSpot}
                        onChange={(e) => setParkSpot(e.target.value.toUpperCase())}
                        placeholder="A1"
                        required
                        className="kiosk-input"
                        maxLength="5"
                      />
                    </div>
                  </div>
                  <button type="submit" className="kiosk-button primary" disabled={loading}>
                    {loading ? (
                      <>
                        <span className="spinner"></span> Processing...
                      </>
                    ) : (
                      <>
                        <span className="button-icon">✓</span> CHECK IN VEHICLE
                      </>
                    )}
                  </button>
                </form>

                {error && (
                  <div className="kiosk-alert error">
                    <span className="alert-icon">⚠️</span>
                    <div>
                      <strong>Check-In Failed</strong>
                      <p>{error}</p>
                    </div>
                  </div>
                )}

                {parkSuccess && (
                  <div className="kiosk-alert success">
                    <span className="alert-icon">✓</span>
                    <div>
                      <strong>Vehicle Checked In Successfully!</strong>
                      <p>You can now find your vehicle using the "Find My Vehicle" tab</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="kiosk-footer">
          <div className="footer-item">
            <span className="footer-icon">📞</span>
            <span>Need Help? Call: (555) 123-4567</span>
          </div>
          <div className="footer-item">
            <span className="footer-icon">💳</span>
            <span>Pay at Exit</span>
          </div>
          <div className="footer-item">
            <span className="footer-icon">🔒</span>
            <span>AI-Powered Security</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;