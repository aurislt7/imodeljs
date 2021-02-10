/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Slider
 */

import "./Slider.scss";
import classnames from "classnames";
import * as React from "react";
import {
  Slider as CompoundSlider, GetRailProps, GetTrackProps, Handles, Rail, SliderItem, SliderModeFunction, Ticks, Tracks,
} from "react-compound-slider";
import { BodyText } from "../text/BodyText";
import { CommonProps } from "../utils/Props";
import { useRefState } from "../utils/hooks/useRefState";
import { Tooltip } from "../tooltip/Tooltip";

// cspell:ignore pushable

/** Properties for [[Slider]] component
 * @public
 */
export interface SliderProps extends CommonProps {
  /** Values to set Slider to initially */
  values: number[];
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Format the min display value */
  formatMin?: (value: number) => string;
  /** Format the max display value */
  formatMax?: (value: number) => string;

  /** Step value. Default is 0.1. */
  step?: number;
  /** The interaction mode. Default is 1. Possible values:
   * 1 - allows handles to cross each other.
   * 2 - keeps the sliders from crossing and separated by a step.
   * 3 - makes the handles pushable and keep them a step apart.
   * function - SliderModeFunction that will be passed the current values and the incoming update.
   *  Your function should return what the mode should be set as.
   */
  mode?: number | SliderModeFunction;

  /** Indicates whether the display of the Slider values is reversed. */
  reversed?: boolean;
  /** Indicates whether the Slider is disabled. */
  disabled?: boolean;
  /** Indicates whether to compensate for the tick marks when determining the width. */
  includeTicksInWidth?: boolean;

  /** Indicates whether to show tooltip with the value. The tooltip will be positioned above the Slider, by default. */
  showTooltip?: boolean;
  /** Indicates whether the tooltip should show below the Slider instead of above. */
  tooltipBelow?: boolean;
  /** Format a value for the tooltip */
  formatTooltip?: (value: number) => string;

  /** Indicates whether to show min & max values to the left & right of the Slider. */
  showMinMax?: boolean;
  /** Image to show for min. */
  minImage?: React.ReactNode;
  /** Image to show for max. */
  maxImage?: React.ReactNode;

  /** Indicates whether to show tick marks under the Slider. */
  showTicks?: boolean;
  /** Indicates whether to show tick labels under the tick marks. */
  showTickLabels?: boolean;
  /** Format a tick mark value */
  formatTick?: (tick: number) => string;
  /** Function to get the tick count. The default tick count is 10. */
  getTickCount?: () => number;
  /** Function to get the tick values. This overrides the tick count from getTickCount.
   * Use this prop if you want to specify your own tick values instead of ticks generated by the slider.
   * The numbers should be valid numbers in the domain and correspond to the step value.
   * Invalid values will be coerced to the closet matching value in the domain.
   */
  getTickValues?: () => number[];

  /** Listens for value changes.
   * Triggered when the value of the slider has changed. This will receive changes at
   * the end of a slide as well as changes from clicks on rails and tracks.
   */
  onChange?: (values: ReadonlyArray<number>) => void;
  /** Listens for value updates.
   *  Called with the values at each update (caution: high-volume updates when dragging).
   */
  onUpdate?: (values: ReadonlyArray<number>) => void;
  /** Function triggered with ontouchstart or onmousedown on a handle. */
  onSlideStart?: (values: ReadonlyArray<number>) => void;
  /** Function triggered on ontouchend or onmouseup on a handle. */
  onSlideEnd?: (values: ReadonlyArray<number>) => void;
}

/**
 * Slider React component displays a range slider.
 * The Slider component uses various components from the
 * [react-compound-slider](https://www.npmjs.com/package/react-compound-slider)
 * package internally.
 * @public
 */
export function Slider(props: SliderProps) {
  const { className, style, min, max, values, step, mode,
    formatMin, formatMax,
    onChange, onUpdate, onSlideStart, onSlideEnd,
    showTicks, showTickLabels, formatTick, getTickCount, getTickValues, includeTicksInWidth,
    reversed, disabled,
    showMinMax, minImage, maxImage,
    showTooltip, tooltipBelow, formatTooltip,
  } = props;
  const domain = [min, max];
  const multipleValues = values.length > 1;
  const containerClassNames = classnames(
    "core-slider-container",
    className,
    disabled && "core-disabled",
    showTickLabels && "core-slider-tickLabels",
    includeTicksInWidth && "core-slider-includeTicksInWidth",
  );
  const sliderClassNames = classnames(
    "core-slider",
    showMinMax && "core-slider-minMax",
  );

  const internalFormatTooltip = React.useCallback((value: number) => {
    if (formatTooltip)
      return formatTooltip(value);

    const actualStep = Math.abs(step ?? 1);

    if (Number.isInteger(actualStep))
      return value.toFixed(0);

    const stepString = actualStep.toString();
    const decimalIndex = stepString.indexOf(".");
    const numDecimals = actualStep.toString().length - (decimalIndex + 1);
    return value.toFixed(numDecimals);
  }, [formatTooltip, step]);

  return (
    <div className={containerClassNames} style={style}>
      {showMinMax &&
        <MinMax value={min} testId="core-slider-min" image={minImage} format={formatMin} />
      }
      <CompoundSlider
        domain={domain}
        step={step}
        mode={mode}
        values={values}
        reversed={reversed}
        disabled={disabled}
        onChange={onChange}
        onUpdate={onUpdate}
        onSlideStart={onSlideStart}
        onSlideEnd={onSlideEnd}
        className={sliderClassNames}
        data-testid="core-slider"
      >
        <Rail>
          {({ getRailProps }) =>
            <Rails getRailProps={getRailProps} />
          }
        </Rail>
        <Tracks right={false} left={!multipleValues}>
          {({ tracks, activeHandleID, getEventData, getTrackProps }) => (
            <div className="slider-tracks">
              {tracks.map(({ id, source, target }) => (
                <TooltipTrack
                  key={id}
                  source={source}
                  target={target}
                  activeHandleID={activeHandleID}
                  getEventData={getEventData}
                  getTrackProps={getTrackProps}
                  showTooltip={showTooltip ?? true}
                  tooltipBelow={tooltipBelow}
                  formatTooltip={internalFormatTooltip}
                  multipleValues={multipleValues}
                />
              ))}
            </div>
          )}
        </Tracks>
        {showTicks &&
          <Ticks values={getTickValues && getTickValues()} count={getTickCount && getTickCount()}>
            {({ ticks }) => (
              <div className="slider-ticks" data-testid="core-slider-ticks">
                {ticks.map((tick: any, index: number) => (
                  <Tick
                    key={tick.id}
                    tick={tick}
                    count={ticks.length}
                    index={index}
                    formatTick={formatTick}
                    showTickLabels={showTickLabels}
                  />
                ))}
              </div>
            )}
          </Ticks>
        }
        <Handles>
          {({ handles, activeHandleID, getHandleProps }) => (
            <div className="slider-handles">
              {handles.map((handle: SliderItem) => (
                <Handle
                  key={handle.id}
                  domain={domain}
                  handle={handle}
                  isActive={handle.id === activeHandleID}
                  getHandleProps={getHandleProps}
                  showTooltip={showTooltip}
                  tooltipBelow={tooltipBelow}
                  formatTooltip={internalFormatTooltip}
                  disabled={disabled}
                />
              ))}
            </div>
          )}
        </Handles>
      </CompoundSlider>
      {showMinMax &&
        <MinMax value={max} testId="core-slider-max" image={maxImage} format={formatMax} />
      }
    </div>
  );
}

/** Properties for [[MinMax]] component */
interface MinMaxProps {
  value: number;
  testId: string;
  image?: React.ReactNode;
  format?: (value: number) => string;
}

/** MinMax component for Slider */
function MinMax(props: MinMaxProps) {
  const { value, testId, image, format } = props;
  let element: React.ReactElement<any>;
  const displayValue = format !== undefined ? format(value) : value;

  if (image)
    element = <>{image}</>;
  else
    element = <BodyText data-testid={testId}>{displayValue}</BodyText>;

  return element;
}

/** Properties for [[Rails]] component */
interface RailsProps {
  getRailProps: GetRailProps;
}

/** Rails component for Slider */
function Rails(props: RailsProps) {
  const { getRailProps } = props;

  return (
    <div className="core-slider-rail" {...getRailProps()}>
      <div className="core-slider-rail-inner" />
    </div>
  );
}

/** Properties for [[TooltipTrack]] component */
interface TooltipTrackProps {
  source: SliderItem;
  target: SliderItem;
  getTrackProps: GetTrackProps;
  activeHandleID: string;
  getEventData: (e: Event) => object;
  showTooltip?: boolean;
  tooltipBelow?: boolean;
  formatTooltip: (value: number) => string;
  multipleValues?: boolean;
}

/** State for [[TooltipTrack]] component */
interface TooltipTrackState {
  percent: number | null;
}

/** TooltipTrack component for Slider */
function TooltipTrack(props: TooltipTrackProps) {
  const { source, target, activeHandleID, showTooltip, tooltipBelow,
    multipleValues, formatTooltip, getTrackProps, getEventData,
  } = props;

  const [percent, setPercent] = React.useState(null as number | null);
  const [tooltipTargetRef, tooltipTarget] = useRefState<HTMLDivElement>();
  // istanbul ignore next
  const onPointerMove = (e: React.PointerEvent) => {
    if (activeHandleID) {
      setPercent(null);
    } else {
      const state = getEventData(e.nativeEvent) as TooltipTrackState;
      setPercent(state.percent);
    }
  };

  // istanbul ignore next
  const onPointerLeave = () => {
    setPercent(null);
  };

  let tooltipText = "";
  if (multipleValues) {
    const sourceValue = formatTooltip(source.value);
    const targetValue = formatTooltip(target.value);
    tooltipText = `${sourceValue} : ${targetValue}`;
  }

  // istanbul ignore next
  return (
    <>
      <div
        className="core-slider_track-tooltip-container"
        style={{ left: `${percent}%` }}
        ref={tooltipTargetRef}
      />
      <Tooltip
        target={tooltipTarget}
        placement={tooltipBelow ? "bottom" : "top"}
        visible={!activeHandleID && percent !== null && showTooltip && multipleValues}
      >
        {tooltipText}
      </Tooltip>
      <div
        className="core-slider-track"
        data-testid="core-slider-track"
        style={{ left: `${source.percent}%`, width: `${target.percent - source.percent}%` }}
        onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}
        {...getTrackProps()}
      >
        <div className="core-slider-track-inner" />
      </div>
    </>
  );
}

/** Properties for [[Tick]] component */
interface TickProps {
  tick: SliderItem;
  count: number;
  index: number;
  formatTick?: (value: number) => string;
  showTickLabels?: boolean;
}

/** Tick component for Slider */
function Tick(props: TickProps) {
  const { tick, count, showTickLabels, formatTick } = props;
  return (
    <div>
      <div className="core-slider-tick-mark" style={{ left: `${tick.percent}%` }} />
      {showTickLabels &&
        <div className="core-slider-tick-label" style={{ marginLeft: `${-(100 / count) / 2}%`, width: `${100 / count}%`, left: `${tick.percent}%` }}>
          {formatTick !== undefined ? formatTick(tick.value) : tick.value}
        </div>
      }
    </div>
  );
}

/** Properties for [[Handle]] component */
interface HandleProps {
  key: string;
  handle: SliderItem;
  isActive: boolean;
  disabled?: boolean;
  domain: number[];
  getHandleProps: (id: string, config: object) => object;
  showTooltip?: boolean;
  tooltipBelow?: boolean;
  formatTooltip?: (value: number) => string;
}

/** Handle component for Slider */
function Handle(props: HandleProps) {
  const {
    domain: [min, max],
    handle: { id, value, percent },
    isActive,
    disabled,
    getHandleProps,
    showTooltip,
    tooltipBelow,
    formatTooltip,
  } = props;

  const [mouseOver, setMouseOver] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const [tooltipTargetRef, tooltipTarget] = useRefState<HTMLDivElement>();

  // istanbul ignore next
  const onMouseEnter = () => {
    setMouseOver(true);
  };

  // istanbul ignore next
  const onMouseLeave = () => {
    setMouseOver(false);
  };

  // istanbul ignore next
  const onFocus = () => {
    setFocused(true);
  };

  // istanbul ignore next
  const onBlur = () => {
    setFocused(false);
  };

  const classNames = classnames(
    "core-slider-handle",
    disabled && "core-disabled",
  );

  const tooltip = formatTooltip ? formatTooltip(value) : /* istanbul ignore next */ value.toString();

  // istanbul ignore next
  return (
    <>
      <Tooltip
        placement={tooltipBelow ? "bottom" : "top"}
        target={tooltipTarget}
        visible={(mouseOver || isActive || focused) && !disabled && showTooltip}
      >
        {tooltip}
      </Tooltip>
      <div
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-disabled={disabled}
        aria-label={tooltip}
        className={classNames}
        data-testid="core-slider-handle"
        ref={tooltipTargetRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        style={{ left: `${percent}%` }}
        {...getHandleProps(id, {
          onMouseEnter,
          onMouseLeave,
          onFocus,
          onBlur,
        })} />
    </>
  );
}
