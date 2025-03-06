require('dotenv').config();

const Captcha = require('./captcha');
const axios = require('axios');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const pepper = process.env.PEPPER;

async function retryOn503(requestFn, maxRetries = 25, delay = 1000) {
  let attempt = 0;
  let lastError;
  while (attempt < maxRetries) {
    try {
      const response = await requestFn();
      return response;
    } catch (error) {
      lastError = error;
      if (error.response && error.response.status === 503) {
        attempt++;
        console.log(`ERROR • HTTP 503, retrying request : ${attempt}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw lastError;
}

function generateHash(king) {
  const toHash = king + pepper;
  return crypto.createHash('md5').update(toHash).digest('hex');
}

async function generateCodes(productType, firstChoice = null, secondChoice = null) {
  try {
    const queenToken = await Captcha.resolve();
    const deviceId = uuidv4().toUpperCase();
    const hash = generateHash(deviceId);

    const headers = {
      'Host': 'webapi.burgerking.fr',
      'Accept': 'application/json, text/plain, */*',
      'x-application': 'WEBSITE',
      'x-device': deviceId,
      'x-version': '10.19.0',
      'Accept-Language': 'fr-FR,fr;q=0.9',
      'User-Agent': 'Mobile/1639457264 CFNetwork/3826.400.120 Darwin/24.3.0',
      'Connection': 'keep-alive',
      'x-platform': 'APP_IOS',
      'Content-Type': 'application/json'
    };

    await retryOn503(() => 
      axios.get('https://webapi.burgerking.fr/blossom/api/v13/public/app/initialize', { headers })
    );

    const data = { king: deviceId, hash, queen: queenToken };

    const offersResponse = await retryOn503(() => 
      axios.post(
        'https://webapi.burgerking.fr/blossom/api/v13/public/offers/page',
        data,
        { headers }
      )
    );

    if (offersResponse.status === 200) {
      const operationsResponse = await retryOn503(() => 
        axios.post(
          'https://webapi.burgerking.fr/blossom/api/v13/public/operation-device/all',
          data,
          { headers }
        )
      );

      const restaurantCodes = [];
      let couponName;
      let couponCode;

      if (productType === 'burger') {
        couponName = "Burger Mystère ou Veggie Mystère";
        couponCode = "burger-mystere";
      } else if (productType === 'icecream') {
        couponName = "Glace Mystère";
        couponCode = "glace-mystere";
      } else {
        throw new Error('ERROR • Unknown ProductType given!');
      }

      for (const operation of operationsResponse.data) {
        if (operation.name === couponName || operation.code === couponCode) {
          const coupons = operation.coupons || [];
          for (const coupon of coupons) {
            restaurantCodes.push(coupon.restaurantCode);
            if (productType === 'burger' && restaurantCodes.length >= 2) {
              break;
            }
            if (productType === 'icecream' && restaurantCodes.length >= 2) {
              break;
            }
          }
          if (restaurantCodes.length >= 2) {
            break;
          }
        }
      }

      if (restaurantCodes.length < 1) {
        throw new Error('ERROR • No codes were found!');
      }

      if (productType === 'icecream') {
        const firstCode = restaurantCodes[0] || null;
        const secondCode = restaurantCodes[1] || null;
        return { firstCode, secondCode };
      }

      if (!firstChoice || !secondChoice) {
        throw new Error('ERROR • The choices were not given for burger codes!');
      }

      const promotionIds = {
        B: '7129189026081447688',
        V: '6645000801566560157'
      };

      const firstPromotionId = promotionIds[firstChoice];
      const secondPromotionId = promotionIds[secondChoice];

      if (!firstPromotionId || !secondPromotionId) {
        throw new Error('ERROR • Invalid choices for burger codes !');
      }

      const firstUrl = `https://webapi.burgerking.fr/blossom/api/v13/public/operation-device/burger-mystere/confirm-choice?couponCode=${restaurantCodes[0]}&promotionId=${firstPromotionId}`;
      const secondUrl = `https://webapi.burgerking.fr/blossom/api/v13/public/operation-device/burger-mystere/confirm-choice?couponCode=${restaurantCodes[1]}&promotionId=${secondPromotionId}`;

      const [firstResponse, secondResponse] = await Promise.all([
        retryOn503(() => axios.post(firstUrl, data, { headers })),
        retryOn503(() => axios.post(secondUrl, data, { headers }))
      ]);

      if (firstResponse.status === 200 && secondResponse.status === 200) {
        const firstCode = firstChoice + restaurantCodes[0].substring(1);
        const secondCode = secondChoice + restaurantCodes[1].substring(1);

        return { firstCode, secondCode };
      } else {
        throw new Error('ERROR • The activation process failed for burger codes!');
      }
    } else {
      throw new Error('ERROR • Failed to fetch the codes from the respondes!');
    }
  } catch (error) {
    console.error('ERROR • A general failure has occured!', error.message);
    throw error;
  }
}

module.exports = { generateCodes };
