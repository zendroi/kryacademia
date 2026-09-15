import { motion, useReducedMotion } from "motion/react";
import { type InputHTMLAttributes, useId, useRef, useState } from "react";

const EASE_IN_OUT_CUBIC_X1 = 0.4;
const EASE_IN_OUT_CUBIC_Y1 = 0;
const EASE_IN_OUT_CUBIC_X2 = 0.2;
const EASE_IN_OUT_CUBIC_Y2 = 1;

const LABEL_TRANSITION = {
  duration: 0.28,
  ease: [
    EASE_IN_OUT_CUBIC_X1,
    EASE_IN_OUT_CUBIC_Y1,
    EASE_IN_OUT_CUBIC_X2,
    EASE_IN_OUT_CUBIC_Y2,
  ] as [number, number, number, number], // cubic-bezier tuple
};

export interface AnimatedInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "defaultValue"> {
  className?: string;
  defaultValue?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  inputClassName?: string;
  label: string;
  labelClassName?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  value?: string;
}

export default function AnimatedInput({
  value,
  defaultValue = "",
  onChange,
  label,
  placeholder = "",
  disabled = false,
  className = "",
  inputClassName = "",
  labelClassName = "",
  icon,
  ...inputProps
}: AnimatedInputProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = value !== undefined;
  const val = isControlled ? value : internalValue;
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const isFloating = !!val || isFocused;
  const shouldReduceMotion = useReducedMotion();
  const reactId = useId();
  const inputId = `animated-input-${reactId.replace(/:/g, "")}`;

  const getLabelAnimation = () => {
    if (shouldReduceMotion) {
      return {};
    }
    if (isFloating) {
      return {
        color: "var(--animated-input-active, var(--color-brand))",
        scale: 0.85,
        y: -24,
      };
    }
    return { color: "var(--animated-input-idle, #6b7280)", scale: 1, y: 0 };
  };

  const getLabelStyle = () => {
    if (!shouldReduceMotion) {
      return {};
    }
    if (isFloating) {
      return {
        color: "var(--animated-input-active, var(--color-brand))",
        transform: "translateY(-24px) scale(0.85)",
      };
    }
    return {
      color: "var(--animated-input-idle, #6b7280)",
      transform: "translateY(0) scale(1)",
    };
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      {icon ? (
        <span
          aria-hidden="true"
          className="absolute top-1/2 left-3 -translate-y-1/2"
        >
          {icon}
        </span>
      ) : null}
      <input
        {...inputProps}
        aria-label={label}
        className={`peer w-full border-0 bg-transparent px-3 py-2 text-sm outline-none ${icon ? "pl-10" : ""} ${inputClassName}`}
        disabled={disabled}
        id={inputId}
        onBlur={() => setIsFocused(false)}
        onChange={(e) => {
          if (!isControlled) {
            setInternalValue(e.target.value);
          }
          onChange?.(e.target.value);
        }}
        onFocus={() => setIsFocused(true)}
        placeholder={isFloating ? placeholder : ""}
        ref={inputRef}
        type={inputProps.type || "text"}
        value={val}
      />
      <motion.label
        animate={getLabelAnimation()}
        className={`pointer-events-none absolute top-1/2 left-3 origin-left -translate-y-1/2 bg-transparent px-1 text-foreground ${labelClassName}`}
        htmlFor={inputId}
        style={{
          zIndex: 2,
          ...getLabelStyle(),
        }}
        transition={shouldReduceMotion ? { duration: 0 } : LABEL_TRANSITION}
      >
        {label}
      </motion.label>
    </div>
  );
}
