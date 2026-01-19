import pytesseract
from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import pytesseract
import base64
import re
import requests

pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'


app = Flask(__name__)
CORS(app)

# Configure Tesseract path (update based on your OS)
# Windows: pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
# Mac: Usually auto-detected if installed via Homebrew
# Linux: Usually auto-detected

BACKEND_URL = "http://localhost:3000"

def preprocess_image(image):
    """Preprocess image for better plate detection"""
    # Convert to grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Apply bilateral filter to reduce noise while keeping edges sharp
    gray = cv2.bilateralFilter(gray, 11, 17, 17)
    
    # Edge detection
    edged = cv2.Canny(gray, 30, 200)
    
    return gray, edged

def find_plate_contour(edged):
    """Find the license plate contour"""
    # Find contours
    contours, _ = cv2.findContours(edged.copy(), cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    
    # Sort contours by area (largest first)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:10]
    
    plate_contour = None
    
    # Find rectangular contour that could be a license plate
    for contour in contours:
        # Approximate the contour
        peri = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.018 * peri, True)
        
        # License plates are typically rectangular (4 points)
        if len(approx) == 4:
            plate_contour = approx
            break
    
    return plate_contour

def extract_plate_image(image, contour):
    """Extract the plate region from image"""
    if contour is None:
        return None
    
    # Get bounding rectangle
    x, y, w, h = cv2.boundingRect(contour)
    
    # Extract plate region with some padding
    padding = 5
    plate_img = image[max(0, y-padding):y+h+padding, max(0, x-padding):x+w+padding]
    
    return plate_img

def clean_plate_text(text):
    """Clean and format the detected text"""
    # Remove special characters and spaces
    text = re.sub(r'[^A-Z0-9]', '', text.upper())
    
    # Common OCR corrections
    text = text.replace('O', '0')
    text = text.replace('I', '1')
    text = text.replace('Z', '2')
    text = text.replace('S', '5')
    
    return text

def read_plate_text(plate_img):
    """Extract text from plate image using OCR"""
    if plate_img is None or plate_img.size == 0:
        return None
    
    # Resize for better OCR
    plate_img = cv2.resize(plate_img, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    
    # Convert to grayscale
    gray = cv2.cvtColor(plate_img, cv2.COLOR_BGR2GRAY)
    
    # Apply thresholding
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    # OCR configuration for better accuracy
    custom_config = r'--oem 3 --psm 7 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    
    # Extract text
    text = pytesseract.image_to_string(thresh, config=custom_config)
    
    # Clean text
    cleaned_text = clean_plate_text(text)
    
    return cleaned_text if len(cleaned_text) >= 4 else None

@app.route('/detect-plate', methods=['POST'])
def detect_plate():
    """Main endpoint to detect license plate from image"""
    try:
        data = request.json
        image_base64 = data.get('image')
        floor = data.get('floor')
        spot = data.get('spot')
        
        if not image_base64:
            return jsonify({'success': False, 'error': 'No image provided'}), 400
        
        # Decode base64 image
        image_data = base64.b64decode(image_base64)
        nparr = np.frombuffer(image_data, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            return jsonify({'success': False, 'error': 'Invalid image'}), 400
        
        # Process image
        gray, edged = preprocess_image(image)
        
        # Find plate contour
        plate_contour = find_plate_contour(edged)
        
        # Extract plate region
        plate_img = extract_plate_image(image, plate_contour)
        
        # Read plate text
        plate_text = read_plate_text(plate_img) if plate_img is not None else None
        
        if not plate_text:
            return jsonify({'success': False, 'error': 'Could not detect plate'}), 400
        
        # Save to backend
        response = requests.post(f'{BACKEND_URL}/park', json={
            'plate': plate_text,
            'floor': floor,
            'spot': spot
        })
        
        if response.status_code == 200:
            return jsonify({
                'success': True,
                'plate': plate_text,
                'floor': floor,
                'spot': spot
            })
        else:
            return jsonify({'success': False, 'error': 'Failed to save to database'}), 500
            
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/simulate-detection', methods=['POST'])
def simulate_detection():
    """Simulated detection for testing without real images"""
    try:
        data = request.json
        plate = data.get('plate', 'ABC1234')
        floor = data.get('floor', 1)
        spot = data.get('spot', 'A1')
        
        # Save to backend
        response = requests.post(f'{BACKEND_URL}/park', json={
            'plate': plate,
            'floor': floor,
            'spot': spot
        })
        
        if response.status_code == 200:
            return jsonify({
                'success': True,
                'plate': plate,
                'floor': floor,
                'spot': spot,
                'simulated': True
            })
        else:
            return jsonify({'success': False, 'error': 'Failed to save'}), 500
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'OK', 'message': 'AI Service is running'})

if __name__ == '__main__':
    print("Starting AI Service on http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)