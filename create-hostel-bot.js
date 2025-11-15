const hostelData = {
    clientName: "My Hawaii Hostel",
    businessName: "My Hawaii Hostel",
    businessInfo: `My Hawaii Hostel is located at 76-6241 Alii Drive in Kailua-Kona, Hawaii. We are just 3 miles south of downtown Kona with easy access to beaches, restaurants, and shops. The trolley stops right in front of the hostel.
  
  CONTACT:
  Phone: (808) 374-2131 (call, text, WhatsApp)
  Email: info@myhawaiihostel.com
  Website: myhawaiihostel.com
  
  RECEPTION HOURS: 8am - 10pm daily (NOT 24-hour reception)
  CHECK-IN: 3pm
  CHECK-OUT: 11am
  
  IMPORTANT: If arriving after 9pm, guests MUST notify us via email, phone, text, or WhatsApp in advance.`,
  
    knowledgeBase: `ACCOMMODATION OPTIONS:
  - Female Dorms: Shared rooms for women only
  - Male Dorms: Shared rooms for men only  
  - Mixed Dorms: Co-ed shared rooms
  - Private Rooms: Queen bed, sleeps up to 2 people (still has shared bathrooms)
  
  Maximum stay: 2 weeks
  
  ROOM FEATURES:
  - Individual outlets at each bed for charging devices
  - Individual lockers with keyed locks (provided free)
  - Ample under-bed storage for luggage
  - Hooks for wet towels and beachwear
  - High-quality comfortable mattresses
  - Fresh, soft linens and towels provided
  - Fans and air conditioning
  - Sturdy wooden bunk beds (no shaking/creaking)
  
  BATHROOMS:
  - Communal shared bathrooms
  - Self-contained bathrooms also available
  - All well-maintained and clean
  
  FACILITIES & AMENITIES:
  ✓ Free WiFi throughout
  ✓ Free coffee and tea service
  ✓ Fully equipped self-service kitchen with commercial fridge
  ✓ BBQ area
  ✓ Indoor/outdoor lounge area
  ✓ Secure storage for bikes, surfboards, and large luggage
  ✓ Free beach towels available to borrow
  ✓ Free luggage storage (including on checkout day)
  ✓ Parking lot adjacent to building (first come, first serve)
  ✓ Overflow public parking 100 meters away
  
  LAUNDRY:
  - No self-service machines
  - Staff will wash and dry laundry same evening ($5 per load)
  - Alternative: Several laundromats in town
  
  LATE CHECKOUT:
  We understand many flights leave late at night. Free luggage storage available on checkout day. Just pack up by 11am, store your bags, and return your key.
  
  QUIET HOURS:
  Enforced to ensure all guests get good rest
  
  LOCATION BENEFITS:
  - Walk to beaches, restaurants, coffee shops
  - Trolley stop directly outside hostel
  - Easy access to all of Kona's attractions
  - Close to downtown but quieter location
  
  BOOKING:
  Book directly through our website: myhawaiihostel.com
  Online booking: app.thebookingbutton.com/properties/myhawaiihostel
  
  MOTTO: "When you're here, you're home."
  
  We believe affordable accommodation shouldn't mean sacrificing style, comfort, or quality service. Our facilities are designed for travelers looking for an interactive, socially-driven lodging experience where you can make new friends while exploring the Big Island.`,
  
    customization: {
      primaryColor: '#0066FF',
      welcomeMessage: "Aloha! 🌺 I'm the AI assistant for My Hawaii Hostel. How can I help you today? Ask me about rooms, pricing, amenities, booking, or things to do in Kona!"
    }
  };
  
  async function createHostelChatbot() {
    try {
      const response = await fetch('http://localhost:3001/api/admin/create-chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hostelData)
      });
  
      const result = await response.json();
  
      if (result.success) {
        console.log('\n✅ MY HAWAII HOSTEL CHATBOT CREATED!\n');
        console.log('Chatbot ID:', result.chatbotId);
        console.log('\n📋 EMBED CODE:\n');
        console.log(result.embedCode);
        console.log('\n\n🎯 NEXT STEPS:');
        console.log('1. Replace YOUR-VM-IP in the embed code with your actual VM IP');
        console.log('2. Give the embed code to the hostel owner');
        console.log('3. They paste it before </body> tag on their website\n');
        console.log('Preview URL:', result.previewUrl);
        console.log('(Also replace YOUR-VM-IP in preview URL)\n');
      } else {
        console.error('❌ Error:', result.error);
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }
  
  createHostelChatbot();