const express = require('express');
const PDFDocument = require('pdfkit');
const path = require('path');
const bodyParser = require('body-parser');
const app = express();

// Bulletproof body parsers for JSON, Form-data, and Raw text/HTML payloads
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(bodyParser.text({ limit: '50mb', type: '*/*' }));

// Paths to custom fonts for clean typography
const fontRegular = path.join(__dirname, 'Roboto-Regular.ttf');
const fontBold = path.join(__dirname, 'Roboto-Bold.ttf');

// Agent branding details (configurable via environment variables)
const AGENT_NAME = process.env.AGENT_NAME || "JOHN DOE";
const AGENT_TITLE = process.env.AGENT_TITLE || "Luxury Property Advisor";
const AGENT_PHONE = process.env.AGENT_PHONE || "+1 (555) 019-2834";
const AGENT_EMAIL = process.env.AGENT_EMAIL || "broker@luxuryrealestate.com";
const AGENT_WHATSAPP = process.env.AGENT_WHATSAPP || "https://wa.me/15550192834";
const AGENT_INSTAGRAM = process.env.AGENT_INSTAGRAM || "https://instagram.com/luxury_homes";
const AGENT_LINKEDIN = process.env.AGENT_LINKEDIN || "https://linkedin.com/in/luxury_homes";
const AGENT_TWITTER = process.env.AGENT_TWITTER || "https://twitter.com/luxury_homes";

// Helper function to download an image and return it as a Buffer
async function fetchImageBuffer(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return arrayBuffer ? Buffer.from(arrayBuffer) : null;
  } catch (e) {
    console.error(`Failed to download image from ${url}:`, e);
    return null;
  }
}

// Intelligent helper to format price numbers with thousands separators and location-based currency symbols
function formatPrice(val, loc = '') {
  if (!val) return '-';
  const trimmed = val.toString().trim();
  
  // Remove formatting to check if it is a raw number (e.g. 2450000)
  const cleanNum = trimmed.replace(/[,.\s]/g, '');
  if (/^\d+$/.test(cleanNum)) {
    const num = parseInt(cleanNum, 10);
    
    // Auto-detect currency symbol based on location keywords
    let currencySymbol = '$'; // Default to Dollar
    const locLower = loc.toLowerCase();
    
    if (locLower.includes('london') || locLower.includes('uk') || locLower.includes('england') || locLower.includes('pound')) {
      currencySymbol = '£';
    } else if (locLower.includes('dubai') || locLower.includes('uae') || locLower.includes('dirham')) {
      currencySymbol = 'AED ';
    } else if (locLower.includes('turk') || locLower.includes('istanbul') || locLower.includes('tl') || locLower.includes('lira')) {
      currencySymbol = '₺';
    } else if (locLower.includes('paris') || locLower.includes('europe') || locLower.includes('germany') || locLower.includes('spain') || locLower.includes('italy') || locLower.includes('euro')) {
      currencySymbol = '€';
    }
    
    // Format with commas as thousands separators (e.g. 2,450,000)
    const formattedNum = num.toLocaleString('en-US');
    return `${currencySymbol}${formattedNum}`;
  }
  
  // If the user already wrote a formatted string (e.g. "£2,450,000"), keep it as is
  return trimmed;
}

app.post('/', async (req, res) => {
  console.log("Interactive 2-page Branded PDF Generation request received!");
  
  let body = req.body;
  
  // If raw body-parser text parsed it as string, parse as JSON
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = { html: body };
    }
  }

  if (!body) body = {};
  
  const html = body.html || '';

  // Bypassing fragile HTML regex parsing by reading directly from request body properties
  const title = body.title || 'Property Listing';
  const location = body.location || 'Not Specified';
  const priceRaw = body.price || '-';
  const rooms = body.rooms || '-';
  const size = body.size || '-';
  const amenities = body.amenities || '';
  const valuation = body.valuation || '';
  const propertyUrl = body.property_url || 'https://www.zillow.com';
  const customerName = body.customer_name || '';

  // Apply intelligent price formatting
  const price = formatPrice(priceRaw, location);

  // Read image URLs directly from the request body
  const rawImageUrl = body.image_url || '';
  const imageUrls = rawImageUrl.split(',').map(url => url.trim()).filter(Boolean);

  const matchDesc = html.match(/<div class='desc'>\s*<p>(.*?)<\/p>/s) || html.match(/<p style='margin-top:16px'>(.*?)<\/p>/s);
  const description = body.description || (matchDesc ? matchDesc[1] : '');

  console.log(`Parsed - Title: "${title}", Total Images: ${imageUrls.length}`);

  try {
    const doc = new PDFDocument({ margin: 50, autoFirstPage: true });

    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    // ==========================================
    // PAGE 1: COVER & SPECIFICATIONS
    // ==========================================

    // 1. Premium Header Banner
    if (customerName) {
      doc.fillColor('#B7791F') // Premium gold/bronze color
         .font(fontBold)
         .fontSize(8.5)
         .text(`A CUSTOM SELECTION FOR ${customerName.toUpperCase()}`, 50, 32, { width: 500, align: 'center' });
    }

    doc.rect(50, 50, 500, 60).fill('#1A252C');
    doc.fillColor('#FFFFFF')
       .font(fontBold)
       .fontSize(16)
       .text(title.toUpperCase(), 60, 70, { width: 480, align: 'center' });

    doc.y = 130; // Move below header

    // 2. Specifications Card
    const specsY = doc.y;
    doc.roundedRect(50, specsY, 500, 65, 8).fillAndStroke('#F8F9FA', '#E2E8F0');
    doc.fillColor('#2D3748').font(fontRegular).fontSize(10);
    
    doc.text('LOCATION', 70, specsY + 15).font(fontBold).text(location, 70, specsY + 30);
    doc.font(fontRegular).text('PRICE', 200, specsY + 15).font(fontBold).text(price, 200, specsY + 30);
    doc.font(fontRegular).text('BEDROOMS', 330, specsY + 15).font(fontBold).text(rooms, 330, specsY + 30);
    doc.font(fontRegular).text('SIZE', 440, specsY + 15).font(fontBold).text(`${size}`, 440, specsY + 30);

    doc.y = specsY + 95;

    // 3. Main Cover Image (Static)
    if (imageUrls.length > 0) {
      const coverUrl = imageUrls[0];
      const coverBuffer = await fetchImageBuffer(coverUrl);
      if (coverBuffer) {
        doc.image(coverBuffer, 50, doc.y, { fit: [500, 320], align: 'center' });
      }
    }

    // 4. Page 1 Footer
    doc.fontSize(8.5)
       .font(fontRegular)
       .fillColor('#A0AEC0')
       .text('Real Estate Portfolio Suite  |  Page 1', 50, 720, { align: 'center', width: 500 });


    // ==========================================
    // PAGE 2: GALLERY & DETAILS & VALUATION
    // ==========================================
    doc.addPage();

    // 1. Title Header for Page 2
    doc.fillColor('#1A252C')
       .font(fontBold)
       .fontSize(14)
       .text('PHOTO GALLERY & DESCRIPTION', 50, 40);
    
    doc.strokeColor('#E2E8F0')
       .lineWidth(1)
       .moveTo(50, 60)
       .lineTo(550, 60)
       .stroke();

    doc.y = 80;

    // 2. Secondary Photo Gallery Grid (Static)
    const galleryUrls = imageUrls.slice(1, 4);
    if (galleryUrls.length > 0) {
      const thumbWidth = 153;
      const thumbHeight = 100;
      const spacing = 20;
      const gridY = doc.y;
      
      for (let i = 0; i < galleryUrls.length; i++) {
        const thumbUrl = galleryUrls[i];
        const thumbBuffer = await fetchImageBuffer(thumbUrl);
        if (thumbBuffer) {
          const xPos = 50 + i * (thumbWidth + spacing);
          doc.image(thumbBuffer, xPos, gridY, { fit: [thumbWidth, thumbHeight] });
        }
      }
      doc.y = gridY + thumbHeight + 20;
    }

    // 3. Description text
    doc.fillColor('#4A5568')
       .font(fontRegular)
       .fontSize(9.5)
       .text(description, { align: 'justify', width: 500, lineGap: 3 });
    doc.moveDown(1.5);

    // 4. Two-Column Layout (Amenities vs Expert Valuation)
    const colsY = doc.y;
    
    // Left Column: Amenities
    doc.fillColor('#1A252C')
       .font(fontBold)
       .fontSize(11)
       .text('AMENITIES & FEATURES', 50, colsY);
    
    doc.strokeColor('#E2E8F0')
       .lineWidth(1)
       .moveTo(50, colsY + 15)
       .lineTo(280, colsY + 15)
       .stroke();
    
    doc.y = colsY + 25;
    const amenitiesList = amenities.split(',').map(a => a.trim()).filter(Boolean);
    doc.fillColor('#4A5568').font(fontRegular).fontSize(9);
    if (amenitiesList.length > 0) {
      amenitiesList.slice(0, 5).forEach(item => {
        doc.text(`• ${item}`, { width: 230, lineGap: 2 });
      });
    } else {
      doc.text('Premium luxury finishes throughout.', { width: 230 });
    }

    // Right Column: Expert Valuation Card
    doc.fillColor('#1A252C')
       .font(fontBold)
       .fontSize(11)
       .text('EXPERT ASSESSMENT', 320, colsY);
    
    doc.strokeColor('#E2E8F0')
       .lineWidth(1)
       .moveTo(320, colsY + 15)
       .lineTo(550, colsY + 15)
       .stroke();

    // Gold/Bronze shaded box for valuation
    doc.roundedRect(320, colsY + 25, 230, 70, 6).fillAndStroke('#FCF8F2', '#E9D8FD');
    doc.fillColor('#B7791F').font(fontBold).fontSize(9);
    
    const valuationList = valuation.split(',').map(v => v.trim()).filter(Boolean);
    doc.y = colsY + 33;
    if (valuationList.length > 0) {
      valuationList.slice(0, 3).forEach(val => {
        doc.text(`★ ${val}`, 330, doc.y, { width: 210, lineGap: 2 });
      });
    } else {
      doc.text('★ High investment yield potential.', 330, doc.y, { width: 210 });
    }

    // Offset below two-column section
    doc.y = Math.max(doc.y, colsY + 105);

    // 5. Eye-catching Interactive 3D Virtual Tour Button!
    const btnY = doc.y + 10;
    doc.roundedRect(50, btnY, 500, 32, 6).fill('#2C3E50');
    doc.fillColor('#FFFFFF')
       .font(fontBold)
       .fontSize(10.5)
       .text('✨ CLICK TO VIEW 3D VIRTUAL TOUR & 16+ HIGH-RES PHOTOS', 50, btnY + 11, { width: 500, align: 'center' });
    
    // Add clickable link over the entire button
    doc.link(50, btnY, 500, 32, propertyUrl);

    doc.y = btnY + 50; // Move below button

    // 6. Premium Agent Profile & Branding Card
    const cardY = doc.y;
    doc.roundedRect(50, cardY, 500, 110, 8).fillAndStroke('#F8F9FA', '#E2E8F0');
    doc.rect(50, cardY, 5, 110).fill('#1A252C'); // Accent side bar

    // Left Column: Agent Profile & Greeting
    doc.fillColor('#1A252C')
       .font(fontBold)
       .fontSize(12)
       .text(AGENT_NAME, 70, cardY + 15);
    
    doc.fillColor('#718096')
       .font(fontRegular)
       .fontSize(9.5)
       .text(AGENT_TITLE, 70, cardY + 30);
    
    const greetingText = customerName
      ? `Hi ${customerName}, thank you for your interest in this listing. Let me guide you to your next dream home.`
      : "Thank you for your interest in our premium real estate listings. Let me guide you to your next dream home.";

    doc.fillColor('#4A5568')
       .fontSize(8.5)
       .text(greetingText, 70, cardY + 50, { width: 230, lineGap: 2 });

    // Right Column: Direct Contact & Clickable Social Media Links
    const rightColX = 320;
    doc.fillColor('#1A252C')
       .font(fontBold)
       .fontSize(10)
       .text('CONTACT DETAILS', rightColX, cardY + 15);

    doc.font(fontRegular)
       .fontSize(9)
       .fillColor('#4A5568')
       .text(`Phone: ${AGENT_PHONE}`, rightColX, cardY + 32)
       .text(`Email: ${AGENT_EMAIL}`, rightColX, cardY + 47);

    // Click-to-Chat WhatsApp Link
    doc.fillColor('#25D366')
       .font(fontBold)
       .text('💬 Chat on WhatsApp', rightColX, cardY + 65)
       .link(rightColX, cardY + 65, 120, 12, AGENT_WHATSAPP);

    // Social Follow Links (Instagram, LinkedIn, X/Twitter)
    const socialY = cardY + 85;
    doc.fillColor('#718096')
       .font(fontRegular)
       .text('Follow me: ', rightColX, socialY);

    const startX = rightColX + 55;
    doc.fillColor('#E1306C')
       .font(fontBold)
       .text('Instagram', startX, socialY)
       .link(startX, socialY, 50, 12, AGENT_INSTAGRAM);

    doc.fillColor('#0077B5')
       .text('LinkedIn', startX + 60, socialY)
       .link(startX + 60, socialY, 45, 12, AGENT_LINKEDIN);

    doc.fillColor('#1A252C')
       .text('Twitter', startX + 115, socialY)
       .link(startX + 115, socialY, 40, 12, AGENT_TWITTER);

    // 7. Page 2 Footer
    doc.fontSize(8.5)
       .font(fontRegular)
       .fillColor('#A0AEC0')
       .text('Real Estate Portfolio Suite  |  Page 2', 50, 720, { align: 'center', width: 500 });

    doc.end();
    console.log("Interactive 2-page Branded PDF generated and sent successfully!");
  } catch (err) {
    console.error("Error during PDF generation:", err);
    res.status(500).send("Error generating PDF");
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`PDF Service local server running on port ${PORT}`);
});
