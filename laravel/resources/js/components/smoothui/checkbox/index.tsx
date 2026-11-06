export interface CheckboxProps {
  checked?: boolean;
  className?: string;
  disabled?: boolean;
  id?: string;
  indeterminate?: boolean;
  name?: string;
  onCheckedChange?: (checked: boolean) => void;
  required?: boolean;
  value?: string;
}

export default function Checkbox({
  checked = false,
  onCheckedChange,
  disabled = false,
  className = '',
  name,
  value,
  id,
  required,
}: CheckboxProps) {
  return (
    <input
      type="checkbox"
      id={id}
      name={name}
      value={value}
      checked={checked}
      required={required}
      disabled={disabled}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      className={`h-4 w-4 rounded border-gray-300 text-[#173051] focus:ring-[#173051] cursor-pointer ${className}`}
    />
  );
}
