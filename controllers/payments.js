import { APIContracts, APIControllers } from 'authorizenet';

function getAuthentication() {
  const authentication = new APIContracts.MerchantAuthenticationType();

  authentication.setName(process.env.AUTHORIZE_NAME);
  authentication.setTransactionKey(process.env.AUTHORIZE_KEY);

  return authentication;
}


/**
 * Create Credit Card
 *
 */
export function createCreditCard(user, card) {
  const authentication = getAuthentication();

  const creditCard = new APIContracts.CreditCardType();
  creditCard.setCardNumber(card.number.replace(/-/g, ''));
  creditCard.setExpirationDate(card.expiry.replace('/', ''));
  creditCard.setCardCode(card.cvc);

  const paymentType = new APIContracts.PaymentType();
  paymentType.setCreditCard(creditCard);

  const paymentProfileType = new APIContracts.CustomerPaymentProfileType();
  paymentProfileType.setCustomerType(APIContracts.CustomerTypeEnum.INDIVIDUAL);
  paymentProfileType.setPayment(paymentType);

  const paymentProfilesList = [];
  paymentProfilesList.push(paymentProfileType);

  const customerProfileType = new APIContracts.CustomerProfileType();
  customerProfileType.setMerchantCustomerId(user.id);
  customerProfileType.setEmail(user.email);
  customerProfileType.setPaymentProfiles(paymentProfilesList);

  const createRequest = new APIContracts.CreateCustomerProfileRequest();
  createRequest.setProfile(customerProfileType);
  createRequest.setMerchantAuthentication(authentication);

  if (process.env.NODE_ENV !== 'production') {
    createRequest.setValidationMode(APIContracts.ValidationModeEnum.TESTMODE);
  }

  const ctrl =
    new APIControllers.CreateCustomerProfileController(createRequest.getJSON());

  return new Promise((resolve, reject) => {
    ctrl.execute(() => {
      const apiResponse = ctrl.getResponse();
      const response =
        new APIContracts.CreateCustomerProfileResponse(apiResponse);

      if (response != null) {
        if (response.getMessages().getResultCode() == APIContracts.MessageTypeEnum.OK) {  // eslint-disable-line
          resolve([
            response.getCustomerProfileId(),
            response.getCustomerPaymentProfileIdList().getNumericString()[0],
          ]);
        } else {
          const reason = {
            resultCode: response.getMessages().getResultCode(),
            errorCode: response.getMessages().getMessage()[0].getCode(),
            errorMessage: response.getMessages().getMessage()[0].getText(),
          };

          const error = new Error(reason.errorMessage);
          error.json = reason;

          reject(error);
        }
      } else {
        reject(new Error('No content'));
      }
    });
  });
}


export function updateCreditCard(profileId, paymentId, card) {
  const authentication = getAuthentication();

  const creditCard = new APIContracts.CreditCardType();
  creditCard.setCardNumber(card.number.replace(/-/g, ''));
  creditCard.setExpirationDate(card.expiry.replace('/', ''));
  creditCard.setCardCode(card.cvc);

  const paymentType = new APIContracts.PaymentType();
  paymentType.setCreditCard(creditCard);

  const customerForUpdate = new APIContracts.CustomerPaymentProfileExType();
  customerForUpdate.setPayment(paymentType);
  customerForUpdate.setCustomerPaymentProfileId(paymentId);

  const updateRequest = new APIContracts.UpdateCustomerPaymentProfileRequest();
  updateRequest.setMerchantAuthentication(authentication);
  updateRequest.setCustomerProfileId(profileId);
  updateRequest.setPaymentProfile(customerForUpdate);

  if (process.env.NODE_ENV !== 'production') {
    updateRequest.setValidationMode(APIContracts.ValidationModeEnum.TESTMODE);
  }

  const ctrl = new APIControllers.UpdateCustomerPaymentProfileController(
    updateRequest.getJSON()
  );

  return new Promise((resolve, reject) => {
    ctrl.execute(() => {
      const apiResponse = ctrl.getResponse();

      const response = new APIContracts.UpdateCustomerPaymentProfileResponse(
        apiResponse
      );

      if (response !== null) {
        if (response.getMessages().getResultCode() === APIContracts.MessageTypeEnum.OK) {// eslint-disable-line
          resolve();
        } else {
          const reason = {
            errorCode: response.getMessages().getMessage()[0].getCode(),
            errorMessage: response.getMessages().getMessage()[0].getText(),
          };

          const error = new Error(reason.errorMessage);
          error.json = reason;

          reject(error);
        }
      } else {
        reject(new Error('No content'));
      }
    });
  });
}


export function validateCreditCard(profileId, paymentId) {
  const authentication = getAuthentication();

  const request = new APIContracts.ValidateCustomerPaymentProfileRequest();
  request.setMerchantAuthentication(authentication);
  request.setCustomerProfileId(profileId);
  request.setCustomerPaymentProfileId(paymentId);
  if (process.env.NODE_ENV !== 'production') {
    request.setValidationMode(APIContracts.ValidationModeEnum.TESTMODE);
  }

  const ctrl = new APIControllers.ValidateCustomerPaymentProfileController(
    request.getJSON()
  );

  return new Promise((resolve, reject) => {
    ctrl.execute(() => {
      const apiResponse = ctrl.getResponse();
      const response = new APIContracts.ValidateCustomerPaymentProfileResponse(
        apiResponse
      );

      if (response !== null) {
        if (response.getMessages().getResultCode() == APIContracts.MessageTypeEnum.OK) { // eslint-disable-line
          resolve();
        } else {
          const reason = {
            errorCode: response.getMessages().getMessage()[0].getCode(),
            errorMessage: response.getMessages().getMessage()[0].getText(),
          };

          const error = new Error(reason.errorMessage);
          error.json = reason;

          reject(error);
        }
      } else {
        reject(new Error('No content'));
      }
    });
  });
}


export function chargeAuthorize(profileId, paymentId, data) {
  const authentication = getAuthentication();

  const profileToCharge = new APIContracts.CustomerProfilePaymentType();
  profileToCharge.setCustomerProfileId(profileId);

  const paymentProfile = new APIContracts.PaymentProfile();
  paymentProfile.setPaymentProfileId(paymentId);
  profileToCharge.setPaymentProfile(paymentProfile);

  const orderDetails = new APIContracts.OrderType();
  // orderDetails.setInvoiceNumber('INV-12345');
  orderDetails.setDescription('Subscription');

  const lineItemList = [];

  data.members.forEach((member, index) => {
    const lineItem = new APIContracts.LineItemType();
    lineItem.setItemId(index);
    lineItem.setName(member.fullName);
    // lineItem.setDescription(member.fullName);
    lineItem.setQuantity('1');
    lineItem.setUnitPrice(member.monthly);
    lineItemList.push(lineItem);
  });

  const lineItems = new APIContracts.ArrayOfLineItem();
  lineItems.setLineItem(lineItemList);

  const transactionRequestType = new APIContracts.TransactionRequestType();
  transactionRequestType.setTransactionType(
    APIContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION
  );
  transactionRequestType.setProfile(profileToCharge);
  transactionRequestType.setAmount(data.total);
  transactionRequestType.setLineItems(lineItems);
  transactionRequestType.setOrder(orderDetails);

  const createRequest = new APIContracts.CreateTransactionRequest();
  createRequest.setMerchantAuthentication(authentication);
  createRequest.setTransactionRequest(transactionRequestType);

  const ctrl = new APIControllers.CreateTransactionController(
    createRequest.getJSON()
  );

  return new Promise((resolve, reject) => {
    ctrl.execute(() => {
      const apiResponse = ctrl.getResponse();
      const response = new APIContracts.CreateTransactionResponse(apiResponse);

      if (response != null) {
        const tResponse = response.getTransactionResponse();
        if (response.getMessages().getResultCode() == APIContracts.MessageTypeEnum.OK) { // eslint-disable-line
          if (tResponse.getMessages()) {
            resolve(tResponse.getTransId());
            // tResponse.getResponseCode()
            // tResponse.getMessages().getMessage()[0].getCode()
            // tResponse.getMessages().getMessage()[0].getDescription()
          } else if (tResponse.getErrors()) {
            const reason = {
              errorCode: tResponse.getErrors().getError()[0].getErrorCode(),
              errorMessage:
              tResponse.getErrors().getError()[0].getErrorText(),
            };

            const error = new Error(reason.errorMessage);
            error.json = reason;

            reject(error);
          }
        } else if (tResponse && tResponse.getErrors()) {
          const reason = {
            errorCode: tResponse.getErrors().getError()[0].getErrorCode(),
            errorMessage:
            tResponse.getErrors().getError()[0].getErrorText(),
          };

          const error = new Error(reason.errorMessage);
          error.json = reason;

          reject(error);
        } else {
          const reason = {
            errorCode: response.getMessages().getMessage()[0].getCode(),
            errorMessage: response.getMessages().getMessage()[0].getText(),
          };

          const error = new Error(reason.errorMessage);
          error.json = reason;

          reject(error);
        }
      } else {
        reject(new Error('No content'));
      }
    });
  });
}


export function getCreditCardInfo(profileId, paymentId) {
  const authentication = getAuthentication();

  const getRequest = new APIContracts.GetCustomerPaymentProfileRequest();
  getRequest.setMerchantAuthentication(authentication);
  getRequest.setCustomerProfileId(profileId);
  getRequest.setCustomerPaymentProfileId(paymentId);

  const ctrl = new APIControllers.GetCustomerProfileController(
    getRequest.getJSON()
  );

  return new Promise((resolve, reject) => {
    ctrl.execute(() => {
      const apiResponse = ctrl.getResponse();
      const response =
        new APIContracts.GetCustomerPaymentProfileResponse(apiResponse);

      if (response != null) {
        if (response.getMessages().getResultCode() == APIContracts.MessageTypeEnum.OK) {  // eslint-disable-line
          const cc = response.getPaymentProfile().getPayment().getCreditCard();
          let middle;

          let expiry = cc.getExpirationDate();
          middle = expiry.length / 2;
          expiry =
            [expiry.substr(0, middle), expiry.substr(middle)].join('/');

          let number = cc.getCardNumber();
          middle = number.length / 2;
          number = [
            'XXXX-XXXX',
            number.substr(0, middle),
            number.substr(middle),
          ].join('-');

          resolve({
            cvc: 'XXX',
            expiry,
            number,
          });
        } else {
          const reason = {
            errorCode: response.getMessages().getMessage()[0].getCode(),
            errorMessage: response.getMessages().getMessage()[0].getText(),
          };

          const error = new Error(reason.errorMessage);
          error.json = reason;

          reject(error);
        }
      } else {
        reject(new Error('No content'));
      }
    });
  });
}
