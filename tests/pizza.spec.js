import { test, expect } from 'playwright-test-coverage';

test('Home', async ({ page }) => {
  await page.goto('/');
  expect(await page.title()).toBe('JWT Pizza');
});

test('Admin', async ({ page }) => {
  const originalPizza = { id: 5, name: 'originalPizza', admins: [{ id: 3, name: 'foobar', email: 'foo@jwt.com' }], stores: [{ id: 8, name: 'orem', totalRevenue: 0 }] };
  let getFranchiseResPos = 0;
  const getFranchiseRes = [[originalPizza], [originalPizza, { id: 18, name: 'tacoPizza', admins: [{ id: 3, name: 'foobar', email: 'foo@jwt.com' }], stores: [] }], [originalPizza]];
  await page.route('*/**/api/auth', async (route) => {
    const loginRes = { user: { id: 3, name: 'foobar', email: 'foo@jwt.com', roles: [{ role: 'admin' }] }, token: 'abcdefg' };
    await route.fulfill({ json: loginRes });
  });
  await page.route('*/**/api/franchise', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: getFranchiseRes[getFranchiseResPos++] });
    } else if (route.request().method() === 'POST') {
      await route.fulfill({
        json: { stores: [], name: 'tacoPizza', admins: [{ email: 'foo@jwt.com', id: 3, name: 'foobar' }], id: 18 },
      });
    }
  });
  await page.route('*/**/api/franchise/18', async (route) => {
    if (route.request().method() === 'DELETE') {
      await route.fulfill({ json: { message: 'franchise deleted' } });
    }
  });
  await page.goto('http://localhost:5173/login');
  await page.getByPlaceholder('Email address').click();
  await page.getByPlaceholder('Email address').fill('foo@jwt.com');
  await page.getByPlaceholder('Password').fill('admin');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByRole('link', { name: 'Admin' }).click();
  await page.getByRole('button', { name: 'Add Franchise' }).click();
  await page.getByPlaceholder('franchise name').click();
  await page.getByPlaceholder('franchise name').fill('tacoPizza');
  await page.getByPlaceholder('franchise name').press('Tab');
  await page.getByPlaceholder('franchisee admin email').fill('foo@jwt.com');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.locator('table tr')).toHaveCount(4);
  await page.getByRole('row', { name: 'tacoPizza foobar Close' }).getByRole('button').click();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('table tr')).toHaveCount(3);
});

test('Register', async ({ page }) => {
  await page.route('*/**/api/auth', async (route) => {
    const regReq = { email: 'bar@jwt.com', password: 'foo' };
    const regRes = { user: { id: 4, name: 'foobar', email: 'bar@jwt.com', roles: [{ role: 'diner' }] }, token: 'foobar' };
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON()).toMatchObject(regReq);
    await route.fulfill({ json: regRes });
  });
  await page.goto('http://localhost:5173/');
  await page.getByRole('link', { name: 'Register' }).click();
  await page.getByPlaceholder('Full name').click();
  await page.getByPlaceholder('Full name').fill('foobar');
  await page.getByPlaceholder('Email address').fill('bar@jwt.com');
  await page.getByPlaceholder('Password').fill('foo');
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page.getByText("The web's best pizza", { exact: true })).toBeVisible();
});

test('Login Purchase', async ({ page }) => {
  await page.route('*/**/api/order/menu', async (route) => {
    const menuRes = [
      { id: 1, title: 'Veggie', image: 'pizza1.png', price: 0.0038, description: 'A garden of delight' },
      { id: 2, title: 'Pepperoni', image: 'pizza2.png', price: 0.0042, description: 'Spicy treat' },
    ];
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: menuRes });
  });
  await page.route('*/**/api/franchise', async (route) => {
    const franchiseRes = [
      {
        id: 2,
        name: 'LotaPizza',
        stores: [
          { id: 4, name: 'Lehi' },
          { id: 5, name: 'Springville' },
          { id: 6, name: 'American Fork' },
        ],
      },
      { id: 3, name: 'PizzaCorp', stores: [{ id: 7, name: 'Spanish Fork' }] },
      { id: 4, name: 'topSpot', stores: [] },
    ];
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: franchiseRes });
  });
  await page.route('*/**/api/auth', async (route) => {
    const loginReq = { email: 'foo@jwt.com', password: 'a' };
    const loginRes = { user: { id: 3, name: 'foobar', email: 'foo@jwt.com', roles: [{ role: 'diner' }] }, token: 'abcdef' };
    expect(route.request().method()).toBe('PUT');
    expect(route.request().postDataJSON()).toMatchObject(loginReq);
    await route.fulfill({ json: loginRes });
  });
  await page.route('*/**/api/order', async (route) => {
    const orderReq = {
      items: [
        { menuId: 1, description: 'Veggie', price: 0.0038 },
        { menuId: 2, description: 'Pepperoni', price: 0.0042 },
      ],
      storeId: '4',
      franchiseId: 2,
    };
    const orderRes = {
      order: {
        items: [
          { menuId: 1, description: 'Veggie', price: 0.0038 },
          { menuId: 2, description: 'Pepperoni', price: 0.0042 },
        ],
        storeId: '4',
        franchiseId: 2,
        id: 23,
      },
      jwt: 'eyJpYXQ',
    };
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON()).toMatchObject(orderReq);
    await route.fulfill({ json: orderRes });
  });
  await page.goto('/');
  // Go to order page
  await page.getByRole('button', { name: 'Order now' }).click();
  // Create order
  await expect(page.locator('h2')).toContainText('Awesome is a click away');
  await page.getByRole('combobox').selectOption('4');
  await page.getByRole('link', { name: 'Image Description Veggie A' }).click();
  await page.getByRole('link', { name: 'Image Description Pepperoni' }).click();
  await expect(page.locator('form')).toContainText('Selected pizzas: 2');
  await page.getByRole('button', { name: 'Checkout' }).click();
  // Login
  await page.getByPlaceholder('Email address').click();
  await page.getByPlaceholder('Email address').fill('foo@jwt.com');
  await page.getByPlaceholder('Email address').press('Tab');
  await page.getByPlaceholder('Password').fill('a');
  await page.getByRole('button', { name: 'Login' }).click();
  // Pay
  await expect(page.getByRole('main')).toContainText('Send me those 2 pizzas right now!');
  await expect(page.locator('tbody')).toContainText('Veggie');
  await expect(page.locator('tbody')).toContainText('Pepperoni');
  await expect(page.locator('tfoot')).toContainText('0.008 ₿');
  await page.getByRole('button', { name: 'Pay now' }).click();
  // Check balance
  await expect(page.getByText('0.008')).toBeVisible();
});

test('Franchise', async ({ page }) => {
  const originalPizza = { id: 5, name: 'originalPizza', admins: [{ id: 3, name: 'foobar', email: 'foo@jwt.com' }], stores: [{ id: 8, name: 'orem', totalRevenue: 0 }] };
  let getFranchiseResPos = 0;
  const getFranchiseRes = [[originalPizza], [originalPizza]];

  await page.route('*/**/api/auth', async (route) => {
    const loginRes = { user: { id: 33, name: 'foobar', email: 'foo@jwt.com', roles: [{ objectId: 5, role: 'franchisee' }] }, token: 'abcdefg' };
    await route.fulfill({ json: loginRes });
  });

  await page.route('*/**/api/franchise/33', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: getFranchiseRes[getFranchiseResPos++] });
    }
  });
  await page.goto('http://localhost:5173/login');
  await page.getByPlaceholder('Email address').click();
  await page.getByPlaceholder('Email address').fill('foo@jwt.com');
  await page.getByPlaceholder('Password').fill('f');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByLabel('Global').getByRole('link', { name: 'Franchise' }).click();
  await expect(page.getByText('originalPizza', { exact: true })).toBeVisible();
});

test('Close', async ({ page }) => {
  const originalPizza = { id: 5, name: 'originalPizza', admins: [{ id: 3, name: 'foobar', email: 'foo@jwt.com' }], stores: [{ id: 8, name: 'orem', totalRevenue: 0 }] };
  const closedPizza = { id: 5, name: 'originalPizza', admins: [{ id: 3, name: 'foobar', email: 'foo@jwt.com' }], stores: [] };
  let getFranchiseResPos = 0;
  const getFranchiseRes = [[originalPizza], [closedPizza]];
  await page.route('*/**/api/auth', async (route) => {
    const loginRes = { user: { id: 3, name: 'foobar', email: 'foo@jwt.com', roles: [{ role: 'admin' }] }, token: 'abcdefg' };
    await route.fulfill({ json: loginRes });
  });
  await page.route('*/**/api/franchise', async (route) => {
    await route.fulfill({ json: getFranchiseRes[getFranchiseResPos++] });
  });
  await page.route('*/**/api/franchise/5/store/8', async (route) => {
    if (route.request().method() === 'DELETE') {
      await route.fulfill({ json: { message: 'store deleted' } });
    }
  });
  await page.goto('http://localhost:5173/login');
  await page.getByPlaceholder('Email address').click();
  await page.getByPlaceholder('Email address').fill('foo@jwt.com');
  await page.getByPlaceholder('Password').fill('admin');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByRole('link', { name: 'Admin' }).click();
  await page.getByRole('row', { name: 'orem 0 ₿ Close' }).getByRole('button').click();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('table tr')).toHaveCount(2);
});

test('Other', async ({ page }) => {
  await page.route('*/**/api/auth', async (route) => {
    const loginRes = { user: { id: 3, name: 'foobar', email: 'foo@jwt.com', roles: [{ role: 'admin' }] }, token: 'abcdefg' };
    await route.fulfill({ json: loginRes });
  });
  await page.goto('http://localhost:5173/login');
  await page.getByPlaceholder('Email address').click();
  await page.getByPlaceholder('Email address').fill('foo@jwt.com');
  await page.getByPlaceholder('Password').fill('a');
  await page.getByRole('button', { name: 'Login' }).click();  
  await page.goto('http://localhost:5173/franchise-dashboard');
  await expect(page.getByText('So you want a piece of the pie?', { exact: true })).toBeVisible();
  await page.goto('http://localhost:5173/about');
  await expect(page.getByText('The secret sauce', { exact: true })).toBeVisible();
  await page.goto('http://localhost:5173/history');
  await expect(page.getByText('Mama Rucci, my my', { exact: true })).toBeVisible();
  await page.goto('http://localhost:5173/diner-dashboard');
  await expect(page.getByText('Your pizza kitchen', { exact: true })).toBeVisible();
  
});

