export const GET_PRODUCTS = `
  query GetProducts($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query) {
      nodes {
        id
        title
        description
        handle
        images(first: 5) {
          nodes {
            id
            url
            altText
            width
            height
          }
        }
        variants(first: 10) {
          nodes {
            id
            title
            price {
              amount
              currencyCode
            }
            compareAtPrice {
              amount
              currencyCode
            }
            selectedOptions {
              name
              value
            }
            availableForSale
          }
        }
        availableForSale
        vendor
        productType
        tags
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
          maxVariantPrice {
            amount
            currencyCode
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const GET_PRODUCT_BY_HANDLE = `
  query GetProductByHandle($handle: String!) {
    product(handle: $handle) {
      id
      title
      description
      handle
      images(first: 10) {
        nodes {
          id
          url
          altText
          width
          height
        }
      }
      variants(first: 10) {
        nodes {
          id
          title
          price {
            amount
            currencyCode
          }
          compareAtPrice {
            amount
            currencyCode
          }
          selectedOptions {
            name
            value
          }
          availableForSale
        }
      }
      availableForSale
      vendor
      productType
      tags
      priceRange {
        minVariantPrice {
          amount
          currencyCode
        }
        maxVariantPrice {
          amount
          currencyCode
        }
      }
    }
  }
`;

export const CREATE_CART = `
  mutation CreateCart($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
        totalQuantity
        cost {
          totalAmount {
            amount
            currencyCode
          }
          subtotalAmount {
            amount
            currencyCode
          }
        }
        lines(first: 250) {
          nodes {
            id
            quantity
            merchandise {
              ... on ProductVariant {
                id
                title
                selectedOptions {
                  name
                  value
                }
                price {
                  amount
                  currencyCode
                }
                product {
                  id
                  title
                  handle
                  featuredImage {
                    url
                    altText
                  }
                }
              }
            }
            cost {
              totalAmount {
                amount
                currencyCode
              }
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const GET_CART = `
  query GetCart($id: ID!) {
    cart(id: $id) {
      id
      checkoutUrl
      totalQuantity
      cost {
        totalAmount {
          amount
          currencyCode
        }
        subtotalAmount {
          amount
          currencyCode
        }
      }
      lines(first: 250) {
        nodes {
          id
          quantity
          merchandise {
            ... on ProductVariant {
              id
              title
              selectedOptions {
                name
                value
              }
              price {
                amount
                currencyCode
              }
              product {
                id
                title
                handle
                featuredImage {
                  url
                  altText
                }
              }
            }
          }
          cost {
            totalAmount {
              amount
              currencyCode
            }
          }
        }
      }
    }
  }
`;

export const ADD_TO_CART = `
  mutation AddToCart($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        id
        checkoutUrl
        totalQuantity
        cost {
          totalAmount {
            amount
            currencyCode
          }
          subtotalAmount {
            amount
            currencyCode
          }
        }
        lines(first: 250) {
          nodes {
            id
            quantity
            merchandise {
              ... on ProductVariant {
                id
                title
                selectedOptions {
                  name
                  value
                }
                price {
                  amount
                  currencyCode
                }
                product {
                  id
                  title
                  handle
                  featuredImage {
                    url
                    altText
                  }
                }
              }
            }
            cost {
              totalAmount {
                amount
                currencyCode
              }
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const UPDATE_CART_LINES = `
  mutation UpdateCartLines($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart {
        id
        checkoutUrl
        totalQuantity
        cost {
          totalAmount {
            amount
            currencyCode
          }
          subtotalAmount {
            amount
            currencyCode
          }
        }
        lines(first: 250) {
          nodes {
            id
            quantity
            merchandise {
              ... on ProductVariant {
                id
                title
                selectedOptions {
                  name
                  value
                }
                price {
                  amount
                  currencyCode
                }
                product {
                  id
                  title
                  handle
                  featuredImage {
                    url
                    altText
                  }
                }
              }
            }
            cost {
              totalAmount {
                amount
                currencyCode
              }
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const REMOVE_FROM_CART = `
  mutation RemoveFromCart($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart {
        id
        checkoutUrl
        totalQuantity
        cost {
          totalAmount {
            amount
            currencyCode
          }
          subtotalAmount {
            amount
            currencyCode
          }
        }
        lines(first: 250) {
          nodes {
            id
            quantity
            merchandise {
              ... on ProductVariant {
                id
                title
                selectedOptions {
                  name
                  value
                }
                price {
                  amount
                  currencyCode
                }
                product {
                  id
                  title
                  handle
                  featuredImage {
                    url
                    altText
                  }
                }
              }
            }
            cost {
              totalAmount {
                amount
                currencyCode
              }
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const GET_COLLECTIONS = `
  query GetCollections($first: Int!) {
    collections(first: $first) {
      nodes {
        id
        title
        description
        handle
        image {
          url
          altText
        }
        products(first: 8) {
          nodes {
            id
            title
            handle
            images(first: 1) {
              nodes {
                url
                altText
              }
            }
            priceRange {
              minVariantPrice {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
  }
`;

export const GET_COLLECTION_PRODUCTS = `
  query GetCollectionProducts($handle: String!, $first: Int!, $after: String) {
    collection(handle: $handle) {
      id
      title
      description
      image {
        url
        altText
      }
      products(first: $first, after: $after) {
        nodes {
          id
          title
          description
          handle
          images(first: 5) {
            nodes {
              id
              url
              altText
              width
              height
            }
          }
          variants(first: 10) {
            nodes {
              id
              title
              price {
                amount
                currencyCode
              }
              compareAtPrice {
                amount
                currencyCode
              }
              selectedOptions {
                name
                value
              }
            }
          }
          availableForSale
          vendor
          productType
          tags
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
            maxVariantPrice {
              amount
              currencyCode
            }
          }
        }
      }
    }
  }
`;