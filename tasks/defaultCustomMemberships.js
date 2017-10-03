require('babel-register');


/*
PLAN 1:
3 Cleanings Plan

CODE  PRICE FREQUENCY/PER YEAR
D0120 $50   2
D0274 $40   1
D1110 $100  3
D0140 $50   1
D0220 $25   1
price: $42

PLAN 2:
4 Cleanings Plan

CODE  PRICE FREQUENCY/PER YEAR
D0120 $50   2
D0274 $40   1
D1110 $100  4
D0140 $50   1
D0220 $25   1
price: $50

PLAN 3:
Perio Maintenance Plan

CODE  PRICE FREQUENCY/PER YEAR
D0120 $50   2
D0274 $40   1
D4910 $120  2
D0140 $50   1
D0220 $25   1
price: $37

PLAN 4:
Adult Fluoride Plan

CODE  PRICE FREQUENCY/PER YEAR
D0120 $50   2
D0274 $40   1
D1110 $100  2
D0140 $50   1
D0220 $25   1
D1206 $40   2
price: 39$
*/

// price is not used. It's here only for completion.
const customMemberships = [
  {
    name: '3 Cleanings Plan',
    price: 42,
    codes: [{
      priceCodeName: 'D0120',
      price: 50,
      frequency: 2
    },
    {
      priceCodeName: 'D0274',
      price: 40,
      frequency: 1
    },
    {
      priceCodeName: 'D1110',
      price: 100,
      frequency: 3
    },
    {
      priceCodeName: 'D0140',
      price: 50,
      frequency: 1
    },
    {
      priceCodeName: 'D0220',
      price: 25,
      frequency: 1
    },
    ]
  }, {
    name: '4 Cleanings Plan',
    price: 50,
    codes: [{
      priceCodeName: 'D0120',
      price: 50,
      frequency: 2
    },
    {
      priceCodeName: 'D0274',
      price: 40,
      frequency: 1
    },
    {
      priceCodeName: 'D1110',
      price: 100,
      frequency: 4
    },
    {
      priceCodeName: 'D0140',
      price: 50,
      frequency: 1
    },
    {
      priceCodeName: 'D0220',
      price: 25,
      frequency: 1
    },
    ]
  }, {
    name: 'Perio Maintenance Plan',
    price: 37,
    codes: [{
      priceCodeName: 'D0120',
      price: 50,
      frequency: 2
    },
    {
      priceCodeName: 'D0274',
      price: 40,
      frequency: 1
    },
    {
      priceCodeName: 'D4910',
      price: 120,
      frequency: 2
    },
    {
      priceCodeName: 'D0140',
      price: 50,
      frequency: 1
    },
    {
      priceCodeName: 'D0220',
      price: 25,
      frequency: 1
    },
    ]
  }, {
    name: 'Adult Fluoride Plan',
    price: 39,
    codes: [{
      priceCodeName: 'D0120',
      price: 50,
      frequency: 2
    },
    {
      priceCodeName: 'D0274',
      price: 40,
      frequency: 1
    },
    {
      priceCodeName: 'D1110',
      price: 100,
      frequency: 2
    },
    {
      priceCodeName: 'D0140',
      price: 50,
      frequency: 1
    },
    {
      priceCodeName: 'D0220',
      price: 25,
      frequency: 1
    },
    {
      priceCodeName: 'D1206',
      price: 40,
      frequency: 2
    },
    ]
  }
];

export default customMemberships;
