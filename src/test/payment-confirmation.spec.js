import PaymentConfirmation from '../_src/payment-confirmation.js';

describe('Successful payment confirmation test', () => {
    let confirmation;

    beforeEach(() => {
        confirmation = new PaymentConfirmation({get: () => {return 'Testing'}});
    });

    it('should try to set something', () => {
        expect(confirmation.process()).toEqual('Payment confirmed for: Testing');
    });
});