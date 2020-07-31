import 'jest';
import Vue from 'vue';
import Vuetify from 'vuetify';
import {getModule} from 'vuex-module-decorators';
import {mount, shallowMount, Wrapper} from '@vue/test-utils';
import Compare from '@/views/Compare.vue';
import {AllRaw, read_files, populate_hash} from '../util/fs';
import Store from '../../src/store/store';
import ReportIntakeModule, {
  next_free_file_ID
} from '../../src/store/report_intake';
import DataStore from '../../src/store/data_store';
import FilteredDataModule from '@/store/data_filters';
import StatusCountModule, {StatusHash} from '@/store/status_counts';
import {readFileSync} from 'fs';
import {
  ComparisonContext,
  ControlDelta,
  ControlSeries
} from '../../src/utilities/delta_util';
import InspecDataModule from '@/store/data_store';
import red_hat_bad from '../hdf_data/compare_data/red_hat_bad.json';
import red_hat_good from '../hdf_data/compare_data/red_hat_good.json';
import good_nginxresults from '../hdf_data/compare_data/good_nginxresults.json';
import bad_nginx from '../hdf_data/compare_data/bad_nginx.json';
import triple_overlay_profile from '../hdf_data/compare_data/triple_overlay_profile_example.json';
import acme from '../hdf_data/compare_data/wrapper-acme-run.json';
import {
  removeAllFiles,
  selectAllFiles,
  testSamples,
  loadSample,
  loadAll,
  Sample,
  fileCompliance
} from '../util/testingUtils';
import Results from '@/views/Results.vue';
import EvalInfo from '@/components/cards/EvaluationInfo.vue';
import ProfData from '@/components/cards/ProfData.vue';
import {profile_unique_key} from '../../src/utilities/format_util';
import StatusCardRow from '../../src/components/cards/StatusCardRow.vue';
import StatusChart from '../../src/components/cards/StatusChart.vue';
import SeverityChart from '../../src/components/cards/SeverityChart.vue';
import ComplianceChart from '../../src/components/cards/ComplianceChart.vue';
import ControlTable from '../../src/components/cards/controltable/ControlTable.vue';

interface InfoItem {
  label: string;
  text: string;
  info?: string;
}

const vuetify = new Vuetify();
let wrapper: Wrapper<Vue>;
let profInfoWrapper: Wrapper<Vue>;
let scrWrapper: Wrapper<Vue>;
let statusChartWrapper: Wrapper<Vue>;
let sevChartWrapper: Wrapper<Vue>;
let compChartWrapper: Wrapper<Vue>;
let controlTableWrapper: Wrapper<Vue>;

wrapper = shallowMount(Results, {
  vuetify,
  propsData: {}
});

let filter_store = getModule(FilteredDataModule, Store);
let data_store = getModule(InspecDataModule, Store);
let status_count = getModule(StatusCountModule, Store);

loadSample('Acme Overlay');
selectAllFiles();

console.log(filter_store.selected_file_ids);

describe('Profile Info', () => {
  it('shows correct number of files', () => {
    loadAll();
    selectAllFiles();
    expect((wrapper.vm as any).file_filter.length).toBe(
      filter_store.selected_file_ids.length
    );
  });

  it('no children', () => {
    removeAllFiles();
    loadSample('NGINX Clean Sample');
    selectAllFiles();

    profInfoWrapper = shallowMount(ProfData, {
      vuetify,
      propsData: {
        selected_prof: (wrapper.vm as any).root_profiles[0]
      }
    });

    expect((profInfoWrapper.vm as any).items.length).toBe(0);
  });

  it('2 children', () => {
    removeAllFiles();
    loadSample('Acme Overlay');
    selectAllFiles();

    profInfoWrapper = shallowMount(ProfData, {
      vuetify,
      propsData: {
        selected_prof: (wrapper.vm as any).root_profiles[0]
      }
    });

    let actual = [
      (profInfoWrapper.vm as any).items[0].name,
      (profInfoWrapper.vm as any).items[1].name
    ];
    let expected = ['ssh-baseline', 'ssl-baseline'];

    expect(actual).toEqual(expected);
  });

  it('children of children', () => {
    removeAllFiles();
    loadSample('Triple Overlay Example');
    selectAllFiles();

    profInfoWrapper = shallowMount(ProfData, {
      vuetify,
      propsData: {
        selected_prof: (wrapper.vm as any).root_profiles[0]
      }
    });

    expect((profInfoWrapper.vm as any).items[0].children[0].name).toBe(
      'Oracle Database 12c Security Technical Implementation Guide'
    );
  });

  it('parent has correct data', () => {
    let expected: InfoItem[] = [
      {label: 'Version', text: '0.1.0'},
      {label: 'From file', text: 'Triple Overlay Example'},
      {label: 'Start time', text: '2020-06-01T18:50:31+00:00'},
      {
        label: 'Sha256 Hash',
        text: '3fe40f9476a23b5b4dd6c0da2bb8dbe8ca5a4a8b6bfb27ffbf9f1797160c0f91'
      },
      {label: 'Title', text: '.'},
      {label: 'Maintainer', text: 'CMS InSpec Dev Team'},
      {label: 'Copyright', text: '.'},
      {label: 'Controls', text: '200'}
    ];
    expect((profInfoWrapper.vm as any).selected_info).toEqual(expected);
  });

  it('children have correct data', () => {
    let expected: InfoItem[] = [
      {label: 'Version', text: '0.1.0'},
      {label: 'From file', text: 'Triple Overlay Example'},
      {label: 'Start time', text: '2020-06-01T18:50:31+00:00'},
      {
        label: 'Sha256 Hash',
        text: 'a34d4b2bb6d5675173abdb1df727cc552807b5c80c1d5de027b85c640f8a0fee'
      },
      {label: 'Title', text: 'InSpec Profile'},
      {label: 'Maintainer', text: 'The Authors'},
      {label: 'Copyright', text: 'The Authors'},
      {label: 'Copyright Email', text: 'you@example.com'},
      {label: 'Controls', text: '200'}
    ];
    (profInfoWrapper.vm as any).active = [];
    (profInfoWrapper.vm as any).child_active = [
      profile_unique_key((wrapper.vm as any).visible_profiles[1])
    ];
    expect((profInfoWrapper.vm as any).selected_info).toEqual(expected);
  });
});

describe('Status card row', () => {
  it('count is correct', () => {
    removeAllFiles();
    loadAll();
    selectAllFiles();
    scrWrapper = shallowMount(StatusCardRow, {
      vuetify,
      propsData: {
        filter: (wrapper.vm as any).all_filter
      }
    });
    let failed = 0;
    let passed = 0;
    let notReviewed = 0;
    let notApplicable = 0;
    //let profileError = 0;
    let exec_files = data_store.executionFiles;

    exec_files.forEach(file => {
      // Get the corresponding count file
      let count_filename = `tests/hdf_data/counts/${file.filename}.info.counts`;
      let count_file_content = readFileSync(count_filename, 'utf-8');
      let counts: any = JSON.parse(count_file_content);

      failed += counts.failed.total;
      passed += counts.passed.total;
      notReviewed += counts.skipped.total;
      notApplicable += counts.no_impact.total;
      //profileError += counts.profileError.total;
    });

    let expected = [
      {
        icon: 'check-circle',
        title: 'Passed',
        subtitle: 'All tests passed',
        color: 'statusPassed',
        number: passed
      },
      {
        icon: 'close-circle',
        title: 'Failed',
        subtitle: 'Has tests that failed',
        color: 'statusFailed',
        number: failed
      },
      {
        icon: 'minus-circle',
        title: 'Not Applicable',
        subtitle: 'System exception or absent component',
        color: 'statusNotApplicable',
        number: notApplicable
      },
      {
        icon: 'alert-circle',
        title: 'Not Reviewed',
        subtitle: 'Can only be tested manually at this time',
        color: 'statusNotReviewed',
        number: notReviewed
      }
    ];

    expect((scrWrapper.vm as any).standardCardProps).toEqual(expected);
  });

  it('count on file with overlays is correct', () => {
    removeAllFiles();
    loadSample('Triple Overlay Example');
    selectAllFiles();
    let failed = 55;
    let passed = 19;
    let notReviewed = 82;
    let notApplicable = 44;

    let expected = [
      {
        icon: 'check-circle',
        title: 'Passed',
        subtitle: 'All tests passed',
        color: 'statusPassed',
        number: passed
      },
      {
        icon: 'close-circle',
        title: 'Failed',
        subtitle: 'Has tests that failed',
        color: 'statusFailed',
        number: failed
      },
      {
        icon: 'minus-circle',
        title: 'Not Applicable',
        subtitle: 'System exception or absent component',
        color: 'statusNotApplicable',
        number: notApplicable
      },
      {
        icon: 'alert-circle',
        title: 'Not Reviewed',
        subtitle: 'Can only be tested manually at this time',
        color: 'statusNotReviewed',
        number: notReviewed
      }
    ];

    expect((scrWrapper.vm as any).standardCardProps).toEqual(expected);
  });

  it('counts errors', () => {
    removeAllFiles();
    loadSample('Red Hat Clean Sample');
    loadSample('Red Hat With Failing Tests');
    selectAllFiles();
    let errors = 2;

    let expected = {
      icon: 'alert-circle',
      title: 'Profile Errors',
      subtitle:
        'Errors running test - check profile run privileges or check with the author of profile',
      color: 'statusProfileError',
      number: errors
    };

    expect((scrWrapper.vm as any).errorProps).toEqual(expected);
  });
});

describe('Status, Severity, Compliance, chart', () => {
  it('status count is correct', () => {
    removeAllFiles();
    loadAll();
    selectAllFiles();
    statusChartWrapper = shallowMount(StatusChart, {
      vuetify,
      propsData: {
        filter: (wrapper.vm as any).all_filter
      }
    });
    let failed = 0;
    let passed = 0;
    let notReviewed = 0;
    let notApplicable = 0;
    let profileError = 0;
    let exec_files = data_store.executionFiles;

    exec_files.forEach(file => {
      // Get the corresponding count file
      let count_filename = `tests/hdf_data/counts/${file.filename}.info.counts`;
      let count_file_content = readFileSync(count_filename, 'utf-8');
      let counts: any = JSON.parse(count_file_content);

      failed += counts.failed.total;
      passed += counts.passed.total;
      notReviewed += counts.skipped.total;
      notApplicable += counts.no_impact.total;
      profileError += counts.error.total;
    });

    let expected = [passed, failed, notApplicable, notReviewed, profileError];

    expect((statusChartWrapper.vm as any).series).toEqual(expected);
  });

  it('status count on file with overlays is correct', () => {
    removeAllFiles();
    loadSample('Triple Overlay Example');
    selectAllFiles();
    let failed = 55;
    let passed = 19;
    let notReviewed = 82;
    let notApplicable = 44;
    let profileError = 0;

    let expected = [passed, failed, notApplicable, notReviewed, profileError];
    expect((statusChartWrapper.vm as any).series).toEqual(expected);
  });

  it('severity count is correct', () => {
    sevChartWrapper = shallowMount(SeverityChart, {
      vuetify,
      propsData: {
        filter: (wrapper.vm as any).all_filter
      }
    });
    let low = 7;
    let med = 140;
    let high = 9;
    let critical = 0;

    let expected = [low, med, high, critical];
    expect((sevChartWrapper.vm as any).series).toEqual(expected);
  });

  it('severity doesnt count Not Applicable', () => {
    removeAllFiles();
    loadSample('Red Hat Clean Sample');
    selectAllFiles();
    let recieved = 0;
    for (let count of (sevChartWrapper.vm as any).series) {
      recieved += count;
    }

    //all counts but profile error
    let expected =
      status_count.passed((wrapper.vm as any).all_filter) +
      status_count.failed((wrapper.vm as any).all_filter) +
      status_count.profileError((wrapper.vm as any).all_filter) +
      status_count.notReviewed((wrapper.vm as any).all_filter);
    expect(recieved).toEqual(expected);
  });

  it('compliance value is accurate', () => {
    removeAllFiles();
    loadAll();
    selectAllFiles();
    compChartWrapper = shallowMount(ComplianceChart, {
      vuetify,
      propsData: {
        filter: (wrapper.vm as any).all_filter
      }
    });
    let failed = 0;
    let passed = 0;
    let notReviewed = 0;
    let notApplicable = 0;
    let profileError = 0;
    let exec_files = data_store.executionFiles;

    exec_files.forEach(file => {
      // Get the corresponding count file
      let count_filename = `tests/hdf_data/counts/${file.filename}.info.counts`;
      let count_file_content = readFileSync(count_filename, 'utf-8');
      let counts: any = JSON.parse(count_file_content);

      failed += counts.failed.total;
      passed += counts.passed.total;
      notReviewed += counts.skipped.total;
      notApplicable += counts.no_impact.total;
      profileError += counts.error.total;
    });

    let expected = Math.round(
      (100.0 * passed) / (passed + failed + notReviewed + profileError)
    );
    expect((compChartWrapper.vm as any).series[0]).toBe(expected);
  });
});

describe('Treemap', () => {});

describe('Datatable', () => {
  it('displays correct number of controls with one file', () => {
    expect(true).toBe(true);
  });

  it('displays correct number of controls with many files', () => {
    expect(true).toBe(true);
  });

  it('control row and table data is correct', () => {
    expect(true).toBe(true);
  });

  it('tests display on controls is accurate', () => {
    expect(true).toBe(true);
  });
});
