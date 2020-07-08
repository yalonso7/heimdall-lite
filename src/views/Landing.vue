<template>
  <v-container>
    <v-row>
      <v-col center xl="8" md="8" sm="12" xs="12">
        <UploadNexus
          :value="true"
          @got-files="on_got_files"
          :persistent="true"
        />
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts">
import Vue from 'vue';
import Component from 'vue-class-component';
import UploadNexus from '@/components/global/UploadNexus.vue';
import {ServerModule} from '@/store/server';

import {Filter} from '@/store/data_filters';
import {FileID} from '@/store/report_intake';
import {BackendModule} from '@/store/backend';

// We declare the props separately
// to make props types inferrable.
const LandingProps = Vue.extend({
  props: {}
});

@Component({
  components: {
    UploadNexus
  }
})
export default class Landing extends LandingProps {
  /* This is supposed to cause the dialog to automatically appear if there is
   * no file uploaded
   */
  mounted() {
    // Redirect logged in users in server mode to the profile page instead of the landing page
    if (BackendModule.serverMode && !!BackendModule.token) {
      this.$router.push('/profile');
    }
  }

  /**
   * Invoked when file(s) are loaded.
   */
  on_got_files(ids: FileID[]) {
    // If just one file, focus it
    if (ids.length === 1) {
      this.$router.push(`/results/${ids[0]}`);
    }

    // If more than one, focus all.
    // TODO: Provide support for focusing a subset of files
    else if (ids.length > 1) {
      this.$router.push(`/results/all`);
    }
  }
}
</script>
