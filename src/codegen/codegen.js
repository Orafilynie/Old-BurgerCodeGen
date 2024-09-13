require('dotenv').config();

const Captcha = require('./captcha');
const axios = require('axios');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const pepper = process.env.PEPPER;

function generateHash(king) {
  const toHash = king + pepper;
  return crypto.createHash('md5').update(toHash).digest('hex');
}

async function generateCodes(firstChoice, secondChoice) {
  try {
    const queenToken = await Captcha.resolve();
    const deviceId = uuidv4().toUpperCase();
    const hash = generateHash(deviceId);

    const headers = {
      'Host': 'webapi.burgerking.fr',
      'Accept': 'application/json, text/plain, */*',
      'x-application': 'WEBSITE',
      'x-device': deviceId,
      'x-version': '10.4.1',
      'Accept-Language': 'fr-FR,fr;q=0.9',
      'User-Agent': 'Mobile/1439457264 CFNetwork/1498.700.2 Darwin/23.6.0',
      'Connection': 'keep-alive',
      'x-platform': 'APP_IOS',
      'Content-Type': 'application/json'
    };

    await axios.get('https://webapi.burgerking.fr/blossom/api/v13/public/features', { headers });
    await axios.get('https://webapi.burgerking.fr/blossom/api/v13/public/app/initialize', { headers });
    await axios.get('https://webapi.burgerking.fr/blossom/api/v13/public/home', { headers });

    const data = { king: deviceId, hash, queen: queenToken };
    const offersResponse = await axios.post('https://webapi.burgerking.fr/blossom/api/v13/public/offers/page', data, { headers });

    if (offersResponse.status === 200) {
      const operationsResponse = await axios.post('https://webapi.burgerking.fr/blossom/api/v13/public/operation-device/all', data, { headers });

      const restaurantCodes = operationsResponse.data
        .map(operation => operation.coupons || [])
        .flat()
        .filter(coupon => coupon.name === "Burger Mystère ou Veggie Mystère")
        .map(coupon => coupon.restaurantCode);

      const firstPromotionId = firstChoice === 'B' ? '7129189026081447688' : '6645000801566560157';
      const secondPromotionId = secondChoice === 'B' ? '7129189026081447688' : '6645000801566560157';

      const firstUrl = `https://webapi.burgerking.fr/blossom/api/v13/public/operation-device/burger-mystere/confirm-choice?couponCode=${restaurantCodes[0]}&promotionId=${firstPromotionId}`;
      const secondUrl = `https://webapi.burgerking.fr/blossom/api/v13/public/operation-device/burger-mystere/confirm-choice?couponCode=${restaurantCodes[1]}&promotionId=${secondPromotionId}`;

      const firstResponse = await axios.post(firstUrl, data, { headers });
      const secondResponse = await axios.post(secondUrl, data, { headers });

      if (firstResponse.status === 200 && secondResponse.status === 200) {

        const firstCode = firstChoice + restaurantCodes[0].substring(1);
        const secondCode = secondChoice + restaurantCodes[1].substring(1);

        return {firstCode, secondCode};
      } else {
        throw new Error('FAILURE  • The activation process went wrong!');
      }
    } else {
      throw new Error('FAILURE  • Failed to fetch the generated codes!');
    }
  } catch (error) {
    throw new Error('FAILURE  • General error!', error);
  }
}

module.exports = { generateCodes };