export function cn(...classNames) {
  return classNames.filter(Boolean).join(' ');
}

export default cn;
