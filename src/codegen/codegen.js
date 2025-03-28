require('dotenv').config();

const Captcha = require('./captcha');
const axios = require('axios');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// Constants
const PEPPER = process.env.PEPPER;
const MAX_RETRIES = 25;
const RETRY_DELAY = 1000;
const API_HEADERS = {
  'Host': 'webapi.burgerking.fr',
  'Accept': 'application/json, text/plain, */*',
  'x-application': 'WEBSITE',
  'x-version': '10.23.0',
  'Accept-Language': 'fr-FR,fr;q=0.9',
  'User-Agent': 'com.unit9.bkFrApp/10.23.0',
  'Connection': 'keep-alive',
  'x-platform': 'APP_IOS',
  'Content-Type': 'application/json'
};
const PROMOTION_IDS = { B: '7129189026081447688', V: '6645000801566560157' };
const PRODUCT_TYPES = {
  BURGER: {
    name: 'Burger Mystère ou Veggie Mystère',
    code: 'burger-mystere',
    requiredChoices: true
  },
  ICECREAM: {
    name: 'Glace Mystère',
    code: 'glace-mystere',
    requiredChoices: false
  }
};

// Utilities
const retryOn503 = async (requestFn, maxRetries = MAX_RETRIES, delay = RETRY_DELAY) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      if (error.response?.status !== 503) throw error;
      console.log('MYSTERY BURGER - HTTP 503 • Retry ${attempt}/${maxRetries}');
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries reached for 503 errors');
};

const generateHash = (king) => crypto.createHash('md5').update(king + PEPPER).digest('hex');

// Core functions
const createDeviceHeaders = (deviceId) => ({
  ...API_HEADERS,
  'x-device': deviceId
});

const fetchOperations = async (data, headers) => {
  const response = await retryOn503(() =>
    axios.post(
      'https://webapi.burgerking.fr/blossom/api/v13/public/operation-device/all',
      data,
      { headers }
    )
  );
  return response.data;
};

const getRestaurantCodes = (operations, productType) => {
  const targetProduct = PRODUCT_TYPES[productType.toUpperCase()];
  const codes = [];
  
  for (const operation of operations) {
    if (operation.name === targetProduct.name || operation.code === targetProduct.code) {
      codes.push(...(operation.coupons || []).map(c => c.restaurantCode));
      if (codes.length >= 2) break;
    }
  }
  
  if (!codes.length) throw new Error('No valid codes found');
  return codes.slice(0, 2);
};

const activateBurgerCodes = async (codes, choices, data, headers) => {
  const [firstChoice, secondChoice] = choices;
  const urls = codes.map((code, i) => 
    `https://webapi.burgerking.fr/blossom/api/v13/public/operation-device/burger-mystere/confirm-choice?` +
    `couponCode=${code}&promotionId=${PROMOTION_IDS[choices[i]]}`
  );

  const responses = await Promise.all(
    urls.map(url => 
      retryOn503(() => axios.post(url, data, { headers }))
    )
  );

  if (responses.some(r => r.status !== 200)) {
    throw new Error('Burger code activation failed');
  }

  return {
    firstCode: firstChoice + codes[0].substring(1),
    secondCode: secondChoice + codes[1].substring(1)
  };
};

// Main function
const generateCodes = async (productType, firstChoice = null, secondChoice = null) => {
  try {
    const deviceId = uuidv4().toUpperCase();
    const headers = createDeviceHeaders(deviceId);
    const data = {
      king: deviceId,
      hash: generateHash(deviceId),
      queen: await Captcha.resolve()
    };

    console.log(data);

    const operations = await fetchOperations(data, headers);
    const restaurantCodes = await getRestaurantCodes(operations, productType);

    if (productType === 'icecream') {
      return { 
        firstCode: restaurantCodes[0], 
        secondCode: restaurantCodes[1] 
      };
    }

    if (![firstChoice, secondChoice].every(Boolean)) {
      throw new Error('Missing choices for burger type');
    }

    return await activateBurgerCodes(
      restaurantCodes,
      [firstChoice, secondChoice],
      data,
      headers
    );
  } catch (error) {
    console.error(`MYSTERY BURGER - Error • ${error.message}`);
    throw error;
  }
};

module.exports = { generateCodes };
