export interface HorizontalMenuItem {
  name: string;
  icon: string;
  to?: {
    name: string;
    params?: { [key: string]: string };
  };
  target?: string;
  href?: string;
  children?: HorizontalMenuItem[];
}


type VerticalMenuHeading = {
  heading: string;
};

type VerticalMenuLink = {
  name: string;
  icon: string;
  to?: {
    name: string;
    params?: { [key: string]: string };
  };
  target?: string;
  href?: string;
  children?: VerticalMenuItem[];
};

export type VerticalMenuItem = VerticalMenuHeading | VerticalMenuLink;
