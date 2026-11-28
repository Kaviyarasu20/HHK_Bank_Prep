import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

function optionsAreEqual(left, right) {
  return left.length === right.length && left.every((option, index) => {
    const next = right[index];
    return (
      option.value === next.value &&
      option.label === next.label &&
      option.group === next.group &&
      option.disabled === next.disabled
    );
  });
}

export function CustomSelect({
  value,
  defaultValue,
  onChange,
  onFocus,
  onBlur,
  onInvalid,
  onKeyDown,
  onClick,
  children,
  className = "",
  style,
  id,
  name,
  form,
  required = false,
  disabled = false,
  ...triggerProps
}) {
  const generatedId = useId().replace(/:/g, "");
  const menuId = `custom-select-menu-${generatedId}`;
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const nativeSelectRef = useRef(null);
  const optionRefs = useRef([]);
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState([]);
  const [uncontrolledValue, setUncontrolledValue] = useState(
    defaultValue === undefined ? undefined : String(defaultValue),
  );
  const [isInvalid, setIsInvalid] = useState(false);
  const isControlled = value !== undefined;
  const selectedValue = isControlled
    ? String(value ?? "")
    : uncontrolledValue ?? nativeSelectRef.current?.value ?? "";
  const selectedIndex = options.findIndex((option) => option.value === selectedValue);
  const activeIndex = selectedIndex >= 0 && !options[selectedIndex].disabled
    ? selectedIndex
    : options.findIndex((option) => !option.disabled);

  useLayoutEffect(() => {
    const select = nativeSelectRef.current;
    if (!select) return;

    const nextOptions = Array.from(select.options, (option) => ({
      value: option.value,
      label: option.label || option.textContent || "",
      group: option.parentElement?.tagName === "OPTGROUP"
        ? option.parentElement.label
        : "",
      disabled: option.disabled,
    }));

    setOptions((current) => optionsAreEqual(current, nextOptions) ? current : nextOptions);
    if (!isControlled) {
      setUncontrolledValue((current) => (
        current !== undefined && nextOptions.some((option) => option.value === current)
          ? current
          : select.value
      ));
    }
  }, [children, isControlled, value]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false);
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  function focusOption(index) {
    if (index < 0 || !options.length) return;
    const start = index;
    let candidate = index;
    while (options[candidate]?.disabled) {
      candidate = (candidate + 1) % options.length;
      if (candidate === start) return;
    }
    optionRefs.current[candidate]?.focus();
  }

  function openMenu(index = activeIndex) {
    if (disabled) return;
    setIsOpen(true);
    requestAnimationFrame(() => focusOption(index));
  }

  function chooseOption(option) {
    if (option.disabled) return;
    const nextValue = option.value;
    setIsOpen(false);
    triggerRef.current?.focus();

    if (nextValue !== selectedValue) {
      if (!isControlled) setUncontrolledValue(nextValue);
      setIsInvalid(false);
      if (nativeSelectRef.current) {
        nativeSelectRef.current.value = nextValue;
        onChange?.({
          target: nativeSelectRef.current,
          currentTarget: nativeSelectRef.current,
          preventDefault() {},
          stopPropagation() {},
        });
      }
    }
  }

  function handleOptionKeyDown(event, index) {
    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
      return;
    }

    let nextIndex = index;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      do {
        nextIndex = (nextIndex + direction + options.length) % options.length;
      } while (options[nextIndex]?.disabled && nextIndex !== index);
      focusOption(nextIndex);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      nextIndex = event.key === "Home"
        ? options.findIndex((option) => !option.disabled)
        : options.findLastIndex((option) => !option.disabled);
      focusOption(nextIndex);
    }
  }

  const selectedOption = options.find((option) => option.value === selectedValue);
  const label = selectedOption?.label ?? "";

  return (
    <div
      className="styled-select"
      ref={rootRef}
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget)) {
          setIsOpen(false);
          onBlur?.(event);
        }
      }}
    >
      <select
        ref={nativeSelectRef}
        className="styled-select-native"
        aria-hidden="true"
        tabIndex={-1}
        value={isControlled ? String(value ?? "") : uncontrolledValue}
        defaultValue={!isControlled && uncontrolledValue === undefined ? defaultValue : undefined}
        name={name}
        form={form}
        required={required}
        disabled={disabled}
        onInvalid={(event) => {
          event.preventDefault();
          setIsInvalid(true);
          triggerRef.current?.focus();
          onInvalid?.(event);
        }}
      >
        {children}
      </select>
      <button
        {...triggerProps}
        ref={triggerRef}
        id={id}
        type="button"
        className={`styled-select-trigger ${className}`.trim()}
        style={style}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-invalid={isInvalid || undefined}
        aria-required={required || undefined}
        onFocus={onFocus}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) {
            if (isOpen) setIsOpen(false);
            else openMenu();
          }
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented) return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openMenu(activeIndex);
          }
        }}
      >
        <span className="styled-select-value">{label}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {isOpen && (
        <div
          id={menuId}
          className="styled-select-menu"
          role="menu"
          aria-label={triggerProps["aria-label"] || "Options"}
        >
          {options.map((option, index) => (
            <div key={`${option.group}-${option.value}-${index}`}>
              {option.group && (index === 0 || options[index - 1].group !== option.group) && (
                <div className="styled-select-group" role="presentation">{option.group}</div>
              )}
              <button
                ref={(element) => { optionRefs.current[index] = element; }}
                type="button"
                className="styled-select-option"
                role="menuitemradio"
                aria-checked={option.value === selectedValue}
                aria-disabled={option.disabled || undefined}
                disabled={option.disabled}
                tabIndex={-1}
                onClick={() => chooseOption(option)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
              >
                <span>{option.label}</span>
                {option.value === selectedValue && <Check size={16} aria-hidden="true" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
