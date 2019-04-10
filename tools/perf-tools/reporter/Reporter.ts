/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs-extra";

interface Entry {
  testSuite: string;
  testName: string;
  valueName: string;
  value: number;
  info: any;
}

export class PerfReporter {
  private _entries: Entry[] = [];

  /**
   * Add entries to performance test report
   * @param testSuite Name of the test suite that is being run
   * @param testName The particular test that is being reported
   * @param valueName The name/description of the value being recorded
   * @param value The actual value of the test
   * @param info A JSON object for additional details
   */
  public addEntry(testSuite: string, testName: string, valueName: string, value: number, info: any) {
    const entry: Entry = { testSuite, testName, valueName, value, info };
    this._entries.push(entry);
  }

  /**
   * Create CSV file with report. Call after all test have run
   * @param fileName Name of the CSV file with or without .csv
   */
  public exportCSV(fileName: string) {
    let finalReport: string = "";
    if (!fileName.endsWith(".csv")) {
      fileName = fileName + ".csv";
    }
    if (!fs.existsSync(fileName)) {
      finalReport += "Test Suite,Test Name,Value Name,Value,Info\n";
    }
    for (const entry of this._entries) {
      finalReport += `${entry.testName},${entry.testSuite},${entry.valueName},${entry.value},${entry.info}\n`;
    }
    fs.appendFileSync(fileName, finalReport);
  }
}
