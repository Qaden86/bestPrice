export type PriceExtraction = {
  selector: string;
  selectorFound: boolean;
  price: number | null;
};

export type AddToCartExtraction = {
  selector: string;
  selectorFound: boolean;
  clicked: boolean;
};
